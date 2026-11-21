from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    case_id: int
    event_type: str
    # Uretim anindaki bildirim basligi ve gosterilecek cumle
    case_title: str
    message: str
    created_at: datetime
    read_at: datetime | None


class UnreadCount(BaseModel):
    count: int
