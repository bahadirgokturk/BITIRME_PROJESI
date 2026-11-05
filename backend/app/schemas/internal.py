from pydantic import BaseModel


class MonitoringRunRead(BaseModel):
    # False: kilit baska sunucudaydi, tur orada calisti
    ran: bool
