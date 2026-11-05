from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case, DecisionFeedback
from app.models.enums import OverrideField


@dataclass(frozen=True)
class TypeCorrection:
    case_number: str
    # Calisma aninda modele giden metin: baslik + aciklama (services/analysis_service.py)
    text: str
    corrected_type: str
    corrected_at: datetime


def type_corrections(session: Session) -> list[TypeCorrection]:
    """Her bildirimin en son tur duzeltmesi; bildirimin acilis sirasiyla."""
    rows = session.execute(
        select(Case, DecisionFeedback.corrected_value, DecisionFeedback.created_at)
        .join(Case, Case.id == DecisionFeedback.case_id)
        .where(DecisionFeedback.field == OverrideField.CASE_TYPE.value)
        .order_by(DecisionFeedback.created_at, DecisionFeedback.id)
    ).all()
    latest = {case.id: (case, value, at) for case, value, at in rows}
    ordered = sorted(latest.values(), key=lambda item: (item[0].created_at, item[0].id))
    return [
        TypeCorrection(
            case_number=case.case_number,
            text=f"{case.title} {case.description}".strip(),
            corrected_type=value,
            corrected_at=at,
        )
        for case, value, at in ordered
    ]
