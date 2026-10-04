"""Agent performans ekrani (E6-5, /manager/agents).

Otomasyon, insan incelemesi, siniflandirma dogrulugu, tekrar isabeti ve agent bazinda
duzeltme orani.
"""

from sqlalchemy.orm import Session

from app.analytics import agent_metrics, case_kpis
from app.analytics.case_kpis import percent
from app.analytics.scope import AnalyticsFilter, days
from app.models import User
from app.schemas.analytics import AgentMetric, AgentMetricsRead, PeriodRead
from app.services.analytics_service import resolve_scope
from app.services.decision_labels import AGENT_LABELS

# Hat sirasi (docs/AGENTS.md bolum 3); listede olmayan agent sona, adiyla
_ORDER = {agent: index for index, agent in enumerate(AGENT_LABELS)}


class AgentMetricsService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def metrics(self, filters: AnalyticsFilter) -> AgentMetricsRead:
        scope = resolve_scope(self._session, self._actor, filters)
        window = days(filters.start, filters.end)
        share = case_kpis.agent_share(self._session, scope, window)
        activity = agent_metrics.activity_by_agent(self._session, scope, window)
        activity.sort(key=lambda row: (_ORDER.get(row.agent, len(_ORDER)), row.agent))
        return AgentMetricsRead(
            period=PeriodRead(start=filters.start, end=filters.end),
            automation_pct=percent(share.automated, share.analyzed),
            human_review_pct=percent(share.human_review, share.analyzed),
            classification_accuracy_pct=percent(
                *agent_metrics.classification_hits(self._session, scope, window)
            ),
            duplicate_precision_pct=percent(
                *agent_metrics.duplicate_hits(self._session, scope, window)
            ),
            agents=[
                AgentMetric(
                    agent=row.agent,
                    label=AGENT_LABELS.get(row.agent, row.agent),
                    decisions=row.decisions,
                    avg_confidence=row.avg_confidence,
                    override_rate_pct=percent(row.overridden, row.decisions),
                )
                for row in activity
            ],
        )
