"""SLA gecikme riski (karar destegi, docs/ANALYTICS.md "Gecikme riski").

Model kurumun butun gecmisinden ogrenir; liste ekrandaki birim/bina filtresine uyar. Donem
filtresi kullanilmaz: gecmis son DELAY_RISK_HISTORY_DAYS gun, liste bugun acik olanlar.
"""

from sqlalchemy.orm import Session

from app.agents.analytics_summary import CATEGORY_LABELS
from app.analytics import delay_risk
from app.analytics.scope import AnalyticsFilter, Scope
from app.core import messages
from app.core.clock import Clock
from app.core.constants import (
    DELAY_RISK_HIGH,
    DELAY_RISK_LIST_LIMIT,
    DELAY_RISK_MEDIUM,
    DELAY_RISK_MIN_CASES,
    MINUTES_PER_HOUR,
    PERCENT,
)
from app.models import User
from app.models.enums import CaseCategory
from app.schemas.analytics import (
    DelayRiskFactor,
    DelayRiskItem,
    DelayRiskLevel,
    DelayRiskModelInfo,
    DelayRiskRead,
)
from app.services.analytics_service import resolve_scope
from app.services.decision_labels import decision_label

PCT_DIGITS = 1


def level(probability: float) -> DelayRiskLevel:
    if probability >= DELAY_RISK_HIGH:
        return DelayRiskLevel.HIGH
    if probability >= DELAY_RISK_MEDIUM:
        return DelayRiskLevel.MEDIUM
    return DelayRiskLevel.LOW


def factor_label(factor: delay_risk.Factor, case: delay_risk.OpenCase) -> str:
    templates = {
        "priority": lambda: messages.DELAY_FACTOR_PRIORITY.format(
            value=decision_label("priority", case.facts.priority or "", {}) or "Belirsiz"
        ),
        "backlog": lambda: messages.DELAY_FACTOR_BACKLOG.format(value=case.facts.backlog),
        "weekend": lambda: messages.DELAY_FACTOR_WEEKEND,
        "after_hours": lambda: messages.DELAY_FACTOR_AFTER_HOURS,
        "sla_hours": lambda: messages.DELAY_FACTOR_SLA.format(
            value=round(case.facts.sla_minutes / MINUTES_PER_HOUR)
        ),
        "category": lambda: messages.DELAY_FACTOR_CATEGORY.format(
            value=CATEGORY_LABELS[CaseCategory(factor.value)]
        ),
        "department": lambda: messages.DELAY_FACTOR_DEPARTMENT.format(
            value=case.department_name or "-"
        ),
    }
    return templates[factor.feature]()


class DelayRiskService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock

    def read(self, filters: AnalyticsFilter) -> DelayRiskRead:
        now = self._clock.now()
        listed = delay_risk.listed_ids(
            self._session, resolve_scope(self._session, self._actor, filters)
        )
        snap = delay_risk.snapshot(self._session, Scope(self._actor.organization_id), listed, now)
        model = delay_risk.fit(snap.history)
        if model is None:
            return DelayRiskRead(
                model=None,
                items=[],
                already_late=snap.already_late,
                message=messages.DELAY_RISK_NO_MODEL.format(count=DELAY_RISK_MIN_CASES),
            )
        scored = sorted(
            ((delay_risk.risk(model, case.facts), case) for case in snap.open_cases),
            key=lambda item: -item[0],
        )
        return DelayRiskRead(
            model=DelayRiskModelInfo(
                train_cases=model.train_n,
                test_cases=model.test_n,
                auc=model.auc,
                late_share_pct=round(model.base_rate * PERCENT, PCT_DIGITS),
            ),
            items=[
                self._item(model, probability, case)
                for probability, case in scored[:DELAY_RISK_LIST_LIMIT]
            ],
            already_late=snap.already_late,
        )

    def _item(
        self, model: delay_risk.RiskModel, probability: float, case: delay_risk.OpenCase
    ) -> DelayRiskItem:
        window = (case.due_at - case.facts.created_at).total_seconds()
        elapsed = (self._clock.now() - case.facts.created_at).total_seconds()
        return DelayRiskItem(
            case_id=case.facts.case_id,
            case_number=case.case_number,
            title=case.title,
            department_name=case.department_name,
            due_at=case.due_at,
            elapsed_pct=round(min(elapsed / window, 1.0) * PERCENT, PCT_DIGITS),
            risk_pct=round(probability * PERCENT, PCT_DIGITS),
            level=level(probability),
            factors=[
                DelayRiskFactor(feature=factor.feature, label=factor_label(factor, case))
                for factor in delay_risk.explain(model, case.facts)
            ],
        )
