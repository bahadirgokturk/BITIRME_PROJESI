"""SLA gecikme riski (karar destegi): bildirim acildigi anda bilinenlerle suresi asilacak mi.

Model kurumun kendi gecmisinden ogrenir: kapanmis (SLA karari kesin) bildirimler ornek, "cozum
hedeften sonra mi geldi" etikettir. Ozellikler yalniz acilis anindaki bilgilerdir (tur kategorisi,
oncelik, birim, gun/saat, birimin o anki acik is sayisi, hedef sure); sonradan ogrenilen hicbir
sey (atama, kabul suresi) girmez, boylece sonuc sizmaz.

Olcum durusttur: bildirimler acilis sirasina dizilir, eskilerle egitilir, en yeni HOLDOUT_SHARE
ile test edilir (ROC-AUC). Ekrana giden model butun gecmisle yeniden egitilir.
Basit ve aciklanabilir: olceklenmis ozellikler + lojistik regresyon; her tahminin en cok etki
eden ozellikleri (katsayi x deger) gerekce olarak doner.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.case_kpis import SECONDS_PER_MINUTE
from app.analytics.scope import NO_DURATION, TERMINAL, TURKEY, Scope
from app.core.constants import (
    DELAY_RISK_FACTOR_LIMIT,
    DELAY_RISK_HISTORY_DAYS,
    DELAY_RISK_HOLDOUT_SHARE,
    DELAY_RISK_MIN_CASES,
    MINUTES_PER_HOUR,
)
from app.models import Case, Department
from app.models.enums import SLA_SETTLED_STATUSES

# Oncelik siralamasi (Priority Agent olcegi); bilinmiyorsa orta
PRIORITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
UNKNOWN_PRIORITY_RANK = 1
# Mesai: 08:30-17:30 yerine saat dilimi kabaca 8-18 (kampus personel vardiyasi)
WORK_START_HOUR = 8
WORK_END_HOUR = 18
SATURDAY = 5
AUC_DIGITS = 4
# Siniflandirma icin iki sinif da (gecikti / zamaninda) bulunmali
BOTH_CLASSES = 2
# Tekrarlanabilir egitim (lbfgs deterministik ama sklearn varsayilanina birakilmaz)
SEED = 0
MAX_ITERATIONS = 1000


@dataclass(frozen=True)
class CaseFacts:
    case_id: int
    created_at: datetime
    category: str
    priority: str | None
    department: str | None
    # Cozum hedefi: due_at - created_at
    sla_minutes: float
    # Acilis aninda ayni birimde acik bildirim sayisi
    backlog: int
    # Gecmis icin: cozum hedeften sonra mi geldi; acik bildirimde bos
    breached: bool | None


@dataclass(frozen=True)
class RiskModel:
    pipeline: Pipeline
    train_n: int
    test_n: int
    # Zaman sirali test setinde ROC-AUC; testte tek sinif varsa olculemez
    auc: float | None
    # Gecmiste gecikme orani (karsilastirma icin)
    base_rate: float


@dataclass(frozen=True)
class Factor:
    feature: str
    # Ozellik degeri (or. backlog=12, category=CONSUMABLE)
    value: Any
    # Log-odds'a katkisi; pozitif = riski artirir
    effect: float


def features(facts: CaseFacts) -> dict[str, float]:
    local = facts.created_at.astimezone(TURKEY)
    return {
        "priority": float(PRIORITY_RANK.get(facts.priority or "", UNKNOWN_PRIORITY_RANK)),
        "backlog": float(facts.backlog),
        "weekend": float(local.weekday() >= SATURDAY),
        "after_hours": float(not WORK_START_HOUR <= local.hour < WORK_END_HOUR),
        "sla_hours": math.log1p(facts.sla_minutes / MINUTES_PER_HOUR),
        f"category={facts.category}": 1.0,
        f"department={facts.department or '-'}": 1.0,
    }


def _pipeline() -> Pipeline:
    return Pipeline(
        [
            ("vectorize", DictVectorizer(sparse=False)),
            ("scale", StandardScaler()),
            (
                "model",
                LogisticRegression(
                    class_weight="balanced", max_iter=MAX_ITERATIONS, random_state=SEED
                ),
            ),
        ]
    )


def _train(rows: Sequence[CaseFacts]) -> Pipeline:
    pipeline = _pipeline()
    pipeline.fit([features(row) for row in rows], [bool(row.breached) for row in rows])
    return pipeline


def _auc(pipeline: Pipeline, test: Sequence[CaseFacts]) -> float | None:
    labels = [bool(row.breached) for row in test]
    if len(set(labels)) < BOTH_CLASSES:
        return None
    scores = pipeline.predict_proba([features(row) for row in test])[:, 1]
    return round(float(roc_auc_score(labels, scores)), AUC_DIGITS)


def fit(history: Sequence[CaseFacts]) -> RiskModel | None:
    """Yetersiz gecmiste (az ornek ya da hic gecikme/hic zamaninda) model kurulmaz."""
    rows = sorted((row for row in history if row.breached is not None), key=lambda r: r.created_at)
    labels = {bool(row.breached) for row in rows}
    if len(rows) < DELAY_RISK_MIN_CASES or len(labels) < BOTH_CLASSES:
        return None
    cut = len(rows) - round(len(rows) * DELAY_RISK_HOLDOUT_SHARE)
    train, test = rows[:cut], rows[cut:]
    auc = _auc(_train(train), test) if {bool(r.breached) for r in train} == {True, False} else None
    return RiskModel(
        pipeline=_train(rows),
        train_n=len(train),
        test_n=len(test),
        auc=auc,
        base_rate=sum(bool(row.breached) for row in rows) / len(rows),
    )


def risk(model: RiskModel, facts: CaseFacts) -> float:
    return float(model.pipeline.predict_proba([features(facts)])[0, 1])


def explain(model: RiskModel, facts: CaseFacts) -> list[Factor]:
    """Riski en cok artiran ozellikler (katsayi x olceklenmis deger), buyukten kucuge."""
    vectorizer: DictVectorizer = model.pipeline.named_steps["vectorize"]
    scaled = model.pipeline[:-1].transform([features(facts)])[0]
    weights = model.pipeline.named_steps["model"].coef_[0]
    present = features(facts)
    effects = [
        (name, weight * value)
        for name, weight, value in zip(vectorizer.feature_names_, weights, scaled, strict=True)
        # Tek-sicak ozelliklerden yalniz bu bildirimde olan (kategori/birim) anlamlidir
        if "=" not in name or name in present
    ]
    positive = sorted((item for item in effects if item[1] > 0), key=lambda item: -item[1])
    return [
        Factor(feature=_base(name), value=_value(name, present), effect=round(effect, AUC_DIGITS))
        for name, effect in positive[:DELAY_RISK_FACTOR_LIMIT]
    ]


def _base(name: str) -> str:
    return name.split("=", 1)[0]


def _value(name: str, present: dict[str, float]) -> Any:
    return name.split("=", 1)[1] if "=" in name else present[name]


def backlog_at(
    department: str | None,
    at: datetime,
    cases: Sequence[tuple[str | None, datetime, datetime | None]],
) -> int:
    """`at` aninda birimde acik bildirim: once acilmis, henuz kapanmamis.

    cases: (birim, acilis, bitis) uclusu; bitis bossa hala acik.
    """
    return sum(
        1
        for dept, opened, finished in cases
        if dept == department and opened < at and (finished is None or finished > at)
    )


@dataclass(frozen=True)
class OpenCase:
    facts: CaseFacts
    case_number: str
    title: str
    department_name: str | None
    due_at: datetime


@dataclass(frozen=True)
class Snapshot:
    history: list[CaseFacts]
    # Suresi henuz dolmamis acik bildirimler (risk listesi)
    open_cases: list[OpenCase]
    # Suresi zaten asilmis acik bildirim sayisi (risk degil, gecikme)
    already_late: int


_COLUMNS = (
    Case.id,
    Case.created_at,
    Case.category,
    Case.priority,
    Department.code,
    Department.name,
    Case.due_at,
    Case.resolved_at,
    Case.closed_at,
    Case.status,
    Case.case_number,
    Case.title,
)


def snapshot(session: Session, scope: Scope, listed: set[int], now: datetime) -> Snapshot:
    """Kurumun son DELAY_RISK_HISTORY_DAYS gunu; `listed` disindaki acik bildirimler listelenmez."""
    since = now - timedelta(days=DELAY_RISK_HISTORY_DAYS)
    rows = session.execute(
        scope.apply(
            select(*_COLUMNS)
            .outerjoin(Department, Department.id == Case.department_id)
            .where(Case.created_at >= since, Case.status.not_in(NO_DURATION))
        )
    ).all()
    load = [(row.code, row.created_at, row.resolved_at or row.closed_at) for row in rows]
    history: list[CaseFacts] = []
    open_cases: list[OpenCase] = []
    already_late = 0
    for row in rows:
        if row.due_at is None:
            continue
        facts = _facts(row, backlog_at(row.code, row.created_at, load))
        if facts.breached is not None:
            history.append(facts)
            continue
        if row.status in TERMINAL or row.id not in listed:
            continue
        if row.due_at <= now:
            already_late += 1
            continue
        open_cases.append(OpenCase(facts, row.case_number, row.title, row.name, row.due_at))
    return Snapshot(history, open_cases, already_late)


def _facts(row: Any, backlog: int) -> CaseFacts:
    settled = row.status in SLA_SETTLED_STATUSES and row.resolved_at is not None
    return CaseFacts(
        case_id=row.id,
        created_at=row.created_at,
        category=str(row.category),
        priority=str(row.priority) if row.priority else None,
        department=row.code,
        sla_minutes=(row.due_at - row.created_at).total_seconds() / SECONDS_PER_MINUTE,
        backlog=backlog,
        breached=(row.resolved_at > row.due_at) if settled else None,
    )


def listed_ids(session: Session, scope: Scope) -> set[int]:
    """Ekrandaki filtreye (birim/bina) uyan acik bildirimler; model kurumun tumunden ogrenir."""
    return set(session.scalars(scope.apply(select(Case.id).where(Case.status.not_in(TERMINAL)))))
