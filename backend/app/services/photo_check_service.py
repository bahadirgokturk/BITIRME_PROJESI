"""Fotograf-metin kontrolu (Photo Check Agent): bildirim fotografi yuklenince arka planda calisir.

Akis: fotograf depodan okunur -> Vision Agent turleri onerir -> Photo Check Agent metnin turuyle
karsilastirir -> karar agent_decisions'a yazilir (manager AI paneli). Celiski varsa ve bildirim
manager kararini bekliyorsa (CLASSIFIED) inceleme kuyruguna duser. Tur hic degismez.

Bildirimin turu henuz yoksa (agent hatti fotograftan sonra bitti) kontrol atlanir.

Kanit fotografi (personel) yuklenince Evidence Check Agent (4.13) calisir: fotograf bildirimin
fotograflariyla karsilastirilir (ayni yer mi); Resolution Agent is tamamlaninca bu karari okur.
"""

import uuid
from dataclasses import dataclass

import numpy as np
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.evidence_check import EvidenceCheckAgent, EvidenceCheckInput
from app.agents.photo_check import PhotoCheckAgent, PhotoCheckDecision, PhotoCheckInput
from app.agents.vision import VisionAgent, VisionInput
from app.agents.vision_model import VisionModel
from app.core.clock import Clock
from app.models.enums import AttachmentKind, CaseStatus
from app.repositories import agent_decision_repository, attachment_repository, case_repository
from app.repositories.agent_decision_repository import DecisionRun
from app.schemas.attachment import AttachmentRead
from app.services.analysis_service import SessionScope
from app.storage import Storage

IMAGE_MIME_PREFIX = "image/"


class PhotoCheckService:
    def __init__(
        self, session: Session, clock: Clock, vision: VisionModel, storage: Storage
    ) -> None:
        self._session = session
        self._clock = clock
        self._vision = vision
        self._storage = storage

    def check(self, attachment_id: int) -> None:
        attachment = attachment_repository.get(self._session, attachment_id)
        if attachment is None:
            return
        case = case_repository.get(self._session, attachment.case_id)
        if case is None or case.case_type is None:
            return
        now = self._clock.now()
        ctx = AgentContext(now=now)
        embedding = self._vision.encoder.encode(self._storage.read(attachment.storage_key))
        vision = VisionAgent(self._vision.bank).run(VisionInput(image_embedding=embedding), ctx)
        inp = PhotoCheckInput(
            case_type_code=case.case_type.code, suggestions=vision.output.suggestions
        )
        result = PhotoCheckAgent().run(inp, ctx)
        run = DecisionRun(case_id=case.id, run_id=uuid.uuid4(), at=now)
        agent_decision_repository.record(self._session, run, inp, result)  # type: ignore[arg-type]
        if result.decision == PhotoCheckDecision.CONFLICTS and case.status is CaseStatus.CLASSIFIED:
            case.needs_human_review = True
        self._session.commit()

    def check_evidence(self, attachment_id: int) -> None:
        """Kanit fotografi bildirimdeki fotograflarin yerinden mi (en benzeri kararlastirir)."""
        evidence = attachment_repository.get(self._session, attachment_id)
        if evidence is None:
            return
        references = [
            a
            for a in attachment_repository.list_for_case(self._session, evidence.case_id)
            if a.kind is AttachmentKind.REPORT and a.mime_type.startswith(IMAGE_MIME_PREFIX)
        ]
        target = self._unit(evidence.storage_key)
        inp = EvidenceCheckInput(
            similarities=[float(target @ self._unit(a.storage_key)) for a in references]
        )
        now = self._clock.now()
        result = EvidenceCheckAgent().run(inp, AgentContext(now=now))
        run = DecisionRun(case_id=evidence.case_id, run_id=uuid.uuid4(), at=now)
        agent_decision_repository.record(self._session, run, inp, result)  # type: ignore[arg-type]
        self._session.commit()

    def _unit(self, storage_key: str) -> np.ndarray:
        # Kosinus icin birim vektor (kodlayici normalize etmeyebilir)
        vector = np.asarray(self._vision.encoder.encode(self._storage.read(storage_key)))
        norm = float(np.linalg.norm(vector))
        return vector / norm if norm else vector


@dataclass(frozen=True)
class PhotoChecker:
    """Kendi oturumunu acar: istegin oturumu yanitla birlikte kapanmistir."""

    sessions: SessionScope
    clock: Clock
    vision: VisionModel
    storage: Storage

    def run(self, attachment_id: int) -> None:
        with self.sessions() as session:
            PhotoCheckService(session, self.clock, self.vision, self.storage).check(attachment_id)

    def run_evidence(self, attachment_id: int) -> None:
        with self.sessions() as session:
            service = PhotoCheckService(session, self.clock, self.vision, self.storage)
            service.check_evidence(attachment_id)


@dataclass(frozen=True)
class PhotoCheckLauncher:
    """Yuklemeden sonra (BackgroundTasks); yaniti geciktirmez (Render'da ~1 sn CPU)."""

    checker: PhotoChecker
    background: BackgroundTasks

    def after_upload(self, attachment: AttachmentRead) -> None:
        if not attachment.mime_type.startswith(IMAGE_MIME_PREFIX):
            return
        # Bildirim fotografi: metinle tur kontrolu; kanit fotografi: yer kontrolu
        checks = {
            AttachmentKind.REPORT: self.checker.run,
            AttachmentKind.EVIDENCE: self.checker.run_evidence,
        }
        self.background.add_task(checks[attachment.kind], attachment.id)
