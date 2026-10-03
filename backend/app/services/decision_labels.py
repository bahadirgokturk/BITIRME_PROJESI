"""Agent ve karar kodlarinin Turkce adlari (manager AI paneli). Gerekce metinleri zaten Turkce
(Reason.message); burada yalniz kisa basliklar var. Siniflandirma karari bir tur kodudur, adi
case_types tablosundan gelir.
"""

from app.agents.analytics_summary import SummarySource
from app.agents.duplicate import DuplicateDecision
from app.agents.monitoring import NO_ACTION, MonitoringAction
from app.agents.resolution import ResolutionDecision
from app.agents.supervisor import SupervisorDecision
from app.agents.verification import VerificationLevel
from app.models.enums import Priority

CLASSIFICATION = "classification"

AGENT_LABELS: dict[str, str] = {
    "intake": "Ön inceleme",
    CLASSIFICATION: "Sınıflandırma",
    "duplicate": "Tekrar kontrolü",
    "verification": "Doğrulama",
    "priority": "Öncelik",
    "routing": "Yönlendirme",
    "supervisor": "Karar",
    "resolution": "İş kontrolü",
    "monitoring": "İzleme",
    "analytics_summary": "Yönetim özeti",
}

# Ayni kod farkli agent'ta farkli anlama gelir (LOW: dusuk guven / dusuk oncelik)
_DECISION_LABELS: dict[str, dict[str, str]] = {
    "intake": {"PARSED": "Anlaşılır", "TOO_SHORT": "Anlaşılmaz ya da çok kısa"},
    "duplicate": {
        DuplicateDecision.DUPLICATE: "Aynı sorun zaten bildirilmiş",
        DuplicateDecision.POSSIBLE_DUPLICATE: "Olası tekrar",
        DuplicateDecision.NEW_CASE: "Yeni sorun",
    },
    "verification": {
        VerificationLevel.LOW: "Düşük güven",
        VerificationLevel.MEDIUM: "Orta güven",
        VerificationLevel.HIGH: "Yüksek güven",
    },
    "priority": {
        Priority.LOW: "Düşük",
        Priority.MEDIUM: "Orta",
        Priority.HIGH: "Yüksek",
        Priority.CRITICAL: "Kritik",
    },
    "routing": {
        "ASSIGN_STAFF": "Personel seçildi",
        "ROUTE_TO_POOL": "Birim havuzuna",
        "NO_DEPARTMENT": "Birim bulunamadı",
    },
    "supervisor": {
        SupervisorDecision.REQUEST_MORE_INFO: "Ek bilgi istendi",
        SupervisorDecision.MERGE_WITH_EXISTING_CASE: "Mevcut bildirimle birleştirildi",
        SupervisorDecision.ESCALATE: "Müdüre yükseltildi",
        SupervisorDecision.REJECT_OUT_OF_SCOPE: "Kapsam dışı",
        SupervisorDecision.SEND_TO_HUMAN_REVIEW: "Müdür incelemesine gönderildi",
        SupervisorDecision.AUTO_ASSIGN: "Otomatik atandı",
        SupervisorDecision.CREATE_TASK: "Görev birim havuzuna açıldı",
    },
    "resolution": {
        ResolutionDecision.RESOLVED: "İş tamamlanmış",
        ResolutionDecision.NEEDS_MORE_EVIDENCE: "Kanıt istendi",
        ResolutionDecision.REOPEN: "İş yapılamamış",
    },
    "monitoring": {
        MonitoringAction.SLA_WARNING: "Süre riskte",
        MonitoringAction.SLA_BREACHED: "Süre aşıldı",
        MonitoringAction.RECOMMEND_REASSIGN: "Başka personel önerildi",
        MonitoringAction.RERUN_ANALYSIS: "Analiz yeniden çalıştırıldı",
        MonitoringAction.CLOSE_UNANSWERED: "Yanıt gelmedi, kapatıldı",
        NO_ACTION: "İşlem gerekmedi",
    },
    "analytics_summary": {
        SummarySource.TEMPLATE: "Şablon metin",
        SummarySource.LLM: "Yerel modelle akıcılaştırıldı",
    },
}


def decision_label(agent: str, code: str, case_type_names: dict[str, str]) -> str | None:
    """Bilinmeyen kod icin None: ekran kodu gosterir."""
    if agent == CLASSIFICATION:
        return case_type_names.get(code)
    return _DECISION_LABELS.get(agent, {}).get(code)
