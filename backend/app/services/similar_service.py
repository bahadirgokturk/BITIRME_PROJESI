"""Bildirmeden once tekrar kontrolu (docs/API.md "Cases", AGENTS.md 4.3).

Form yazilirken Classification ve Duplicate Agent'lari, agent hattinin kullandigi kurallarla ve
ayni aday sorgusuyla calisir: ayni binada son 24 saatte acilmis, sorunu acik bildirimler. Esik
(0.60) ustundekiler en benzer once gosterilir. Karar kaydedilmez (henuz bildirim yok); kisi
"destekle" derse kendi kaydi acilip bagliysa o kayit agent_decisions'a degil olay kaydina gecer.
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.classification import CaseTypeInfo, ClassificationAgent, ClassificationInput
from app.agents.duplicate import (
    POSSIBLE_DUPLICATE_FROM,
    DuplicateAgent,
    DuplicateCandidate,
    DuplicateInput,
)
from app.agents.model_store import get_classifier
from app.core.clock import Clock
from app.core.errors import NotFoundError
from app.models import Case, CaseType, Location, User
from app.repositories import analysis_repository, location_repository
from app.repositories.analysis_repository import CandidateWindow
from app.schemas.case import CaseCreate, CaseRead, SimilarOpenCase, SimilarRead, SupportCreate
from app.services.authorization import ensure_same_organization
from app.services.case_service import CaseService, title_from

# Agent hattiyla ayni pencere (services/analysis_service.py DUPLICATE_WINDOW)
SIMILAR_WINDOW = timedelta(hours=24)


class SimilarCases:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock

    def find(self, data: CaseCreate) -> SimilarRead:
        return SimilarRead(items=[_summary(case) for case in self._matches(data)])

    def support(self, data: SupportCreate) -> CaseRead:
        """Ana kayit yalniz sunucunun benzer buldugu kayitlardan biri olabilir; disaridan bir id
        verilirse kayit yokmus gibi 404 (baskasinin bildirimine erisim yok)."""
        parent = next((c for c in self._matches(data) if c.id == data.case_id), None)
        if parent is None:
            raise NotFoundError()
        return CaseService(self._session, self._actor, self._clock).support(data, parent)

    def _matches(self, data: CaseCreate) -> list[Case]:
        location = self._location(data.location_id)
        now = self._clock.now()
        window = CandidateWindow(
            self._actor.organization_id, location.path, now - SIMILAR_WINDOW, now
        )
        candidates = {c.id: c for c in analysis_repository.open_in_building(self._session, window)}
        if not candidates:
            return []
        ctx = AgentContext(now=now)
        check = DuplicateInput(
            text=data.description,
            case_type_code=self._case_type(data, ctx),
            location_id=location.id,
            location_path=location.path,
            reported_at=now,
            candidates=[_candidate(c) for c in candidates.values()],
        )
        similar = DuplicateAgent().run(check, ctx).output.similar_cases
        return [candidates[s.case_id] for s in similar if s.score >= POSSIBLE_DUPLICATE_FROM]

    def _case_type(self, data: CaseCreate, ctx: AgentContext) -> str:
        case_types = analysis_repository.active_case_types(
            self._session, self._actor.organization_id
        )
        inp = ClassificationInput(
            title=data.title or title_from(data.description),
            description=data.description,
            case_types=[
                CaseTypeInfo(
                    code=ct.code, name=ct.name, category=ct.category, keywords=list(ct.keywords)
                )
                for ct in case_types
            ],
        )
        return ClassificationAgent(get_classifier()).run(inp, ctx).decision

    def _location(self, location_id: int) -> Location:
        location = location_repository.get(self._session, location_id)
        if location is None or not location.is_active:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=location.organization_id)
        return location


def _type_of(case: Case) -> CaseType:
    # Aday sorgusu yalniz siniflandirilmis kayitlari getirir; bos tur bir hatadir
    if case.case_type is None:
        raise ValueError(f"Aday bildirim {case.id} siniflandirilmamis")
    return case.case_type


def _candidate(case: Case) -> DuplicateCandidate:
    return DuplicateCandidate(
        case_id=case.id,
        text=case.description,
        case_type_code=_type_of(case).code,
        location_id=case.location_id,
        location_path=case.location.path,
        created_at=case.created_at,
        duplicate_count=case.duplicate_count,
    )


def _summary(case: Case) -> SimilarOpenCase:
    return SimilarOpenCase(
        case_id=case.id,
        case_type_name=_type_of(case).name,
        location_name=case.location.name,
        created_at=case.created_at,
        supporters=1 + case.duplicate_count,
    )
