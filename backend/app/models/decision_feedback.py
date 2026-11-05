"""Manager duzeltmeleri (docs/DATABASE.md "decision_feedback").

Her duzeltme ilgili agent kararina baglanir: modelin yeniden egitimi icin etiketli veri ve
"override rate" metriginin kaynagi (docs/ANALYTICS.md). Agent hatti kapaliyken yapilan duzeltmede
karar yoktur (decision_id bos).
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin


class DecisionFeedback(IdMixin, Base):
    __tablename__ = "decision_feedback"

    decision_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("agent_decisions.id"), index=True
    )
    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"), index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    # case_type | priority | department
    field: Mapped[str] = mapped_column(String(30))
    # Kodlar saklanir (SOAP_EMPTY, HIGH, SUPPORT_SERVICES): id'ler ortamlar arasinda degisir
    original_value: Mapped[str | None] = mapped_column(String(100))
    corrected_value: Mapped[str] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
