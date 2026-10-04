"""Agent performansi (docs/ANALYTICS.md bolum 3; RQ1-RQ3).

Canli sistemde gercek tur etiketi yoktur: manager'in duzeltmedigi tahmin dogru kabul edilir
(ANALYTICS.md "Classification accuracy" varsayimi). Bu iyimser bir olcumdur; RQ1'in durust cevabi
gercek test seti uzerindeki offline degerlendirmedir (ai/models/.../metrics.json).
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.classification import ClassificationAgent
from app.agents.duplicate import DuplicateAgent, DuplicateDecision
from app.analytics.decisions import latest_decisions
from app.analytics.scope import Scope, Window
from app.models import AgentDecision, Case, CaseType, DecisionFeedback
from app.models.enums import CaseStatus

# Guven skorlari 0-1; 3 ondalik veritabanindaki hassasiyetle ayni (cases.confidence_score)
CONFIDENCE_DECIMALS = 3
FLAGGED_AS_DUPLICATE = (DuplicateDecision.DUPLICATE, DuplicateDecision.POSSIBLE_DUPLICATE)


@dataclass(frozen=True)
class AgentActivity:
    agent: str
    decisions: int
    avg_confidence: float | None
    overridden: int


def classification_hits(session: Session, scope: Scope, window: Window) -> tuple[int, int]:
    """(son tur ile ayni tahmin, tahmin) -- donemde acilan bildirimler, birlestirilenler dahil."""
    latest = latest_decisions(ClassificationAgent.name)
    statement = scope.apply(
        select(func.count(Case.id).filter(latest.c.decision == CaseType.code), func.count(Case.id))
        .select_from(Case)
        .join(latest, latest.c.case_id == Case.id)
        .outerjoin(CaseType, CaseType.id == Case.case_type_id)
        .where(window.contains(Case.created_at))
    )
    hits, total = session.execute(statement).one()
    return hits, total


def duplicate_hits(session: Session, scope: Scope, window: Window) -> tuple[int, int]:
    """(birlestirilen, tekrar diye isaretlenen). Kesin tekrar otomatik birlestirilir; olasi tekrari
    manager birlestirir ya da birlestirmez. Hala inceleme kuyrugundakiler henuz sayilmaz."""
    latest = latest_decisions(DuplicateAgent.name)
    waiting = Case.needs_human_review.is_(True) & (Case.status == CaseStatus.CLASSIFIED)
    statement = scope.apply(
        select(func.count(Case.id).filter(Case.status == CaseStatus.MERGED), func.count(Case.id))
        .select_from(Case)
        .join(latest, latest.c.case_id == Case.id)
        .where(
            window.contains(Case.created_at),
            latest.c.decision.in_(FLAGGED_AS_DUPLICATE),
            ~waiting,
        )
    )
    merged, flagged = session.execute(statement).one()
    return merged, flagged


def activity_by_agent(session: Session, scope: Scope, window: Window) -> list[AgentActivity]:
    """Donemde verilen kararlar: sayi, ortalama guven ve manager duzeltmesi."""
    decided = scope.apply(
        select(
            AgentDecision.agent_name,
            func.count(AgentDecision.id),
            func.avg(AgentDecision.confidence),
        )
        .join(Case, Case.id == AgentDecision.case_id)
        .where(window.contains(AgentDecision.created_at))
        .group_by(AgentDecision.agent_name)
    )
    corrected = scope.apply(
        select(AgentDecision.agent_name, func.count(DecisionFeedback.id))
        .join(Case, Case.id == AgentDecision.case_id)
        .join(DecisionFeedback, DecisionFeedback.decision_id == AgentDecision.id)
        .where(window.contains(AgentDecision.created_at))
        .group_by(AgentDecision.agent_name)
    )
    overrides = {agent: total for agent, total in session.execute(corrected)}
    return [
        AgentActivity(agent, total, _confidence(avg), overrides.get(agent, 0))
        for agent, total, avg in session.execute(decided)
    ]


def _confidence(value: Decimal | None) -> float | None:
    return None if value is None else round(float(value), CONFIDENCE_DECIMALS)
