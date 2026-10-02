"""DB enum'lari (docs/DATABASE.md bolum 2). Deger = isim; PostgreSQL native enum olarak saklanir."""

from enum import StrEnum


class UserRole(StrEnum):
    REPORTER = "REPORTER"
    STAFF = "STAFF"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"


class ReporterKind(StrEnum):
    STUDENT = "STUDENT"
    ACADEMIC = "ACADEMIC"
    PERSONNEL = "PERSONNEL"


class LocationKind(StrEnum):
    CAMPUS = "CAMPUS"
    BUILDING = "BUILDING"
    FLOOR = "FLOOR"
    ROOM = "ROOM"
    WC = "WC"
    CORRIDOR = "CORRIDOR"
    OUTDOOR = "OUTDOOR"
    OTHER = "OTHER"


class CaseCategory(StrEnum):
    CLEANING = "CLEANING"
    CONSUMABLE = "CONSUMABLE"
    TECHNICAL = "TECHNICAL"
    IT = "IT"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"
    FOOD_SERVICE = "FOOD_SERVICE"
    OTHER = "OTHER"


class Priority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CaseStatus(StrEnum):
    # Gecis kurallari: docs/WORKFLOW.md bolum 1
    NEW = "NEW"
    ANALYZING = "ANALYZING"
    NEEDS_INFO = "NEEDS_INFO"
    CLASSIFIED = "CLASSIFIED"
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    VERIFICATION = "VERIFICATION"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"
    ESCALATED = "ESCALATED"
    REJECTED = "REJECTED"
    MERGED = "MERGED"


class ActorType(StrEnum):
    USER = "USER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"


class CaseEventType(StrEnum):
    # docs/WORKFLOW.md bolum 3. DB'de varchar: yeni olay tipi migration gerektirmez
    CASE_CREATED = "CASE_CREATED"
    ANALYSIS_STARTED = "ANALYSIS_STARTED"
    AI_CLASSIFIED = "AI_CLASSIFIED"
    DUPLICATE_CHECKED = "DUPLICATE_CHECKED"
    VERIFICATION_SCORED = "VERIFICATION_SCORED"
    PRIORITY_CALCULATED = "PRIORITY_CALCULATED"
    ROUTED = "ROUTED"
    SUPERVISOR_DECIDED = "SUPERVISOR_DECIDED"
    HUMAN_REVIEW_REQUESTED = "HUMAN_REVIEW_REQUESTED"
    INFO_REQUESTED = "INFO_REQUESTED"
    INFO_PROVIDED = "INFO_PROVIDED"
    CASE_MERGED = "CASE_MERGED"
    TASK_CREATED = "TASK_CREATED"
    TASK_ACCEPTED = "TASK_ACCEPTED"
    TASK_DECLINED = "TASK_DECLINED"
    TASK_REASSIGNED = "TASK_REASSIGNED"
    WORK_STARTED = "WORK_STARTED"
    WORK_COMPLETED = "WORK_COMPLETED"
    EVIDENCE_UPLOADED = "EVIDENCE_UPLOADED"
    RESOLUTION_EVALUATED = "RESOLUTION_EVALUATED"
    # Resolution Agent personelden kanit istedi (gorev geri dondu)
    EVIDENCE_REQUESTED = "EVIDENCE_REQUESTED"
    RESOLUTION_VERIFIED = "RESOLUTION_VERIFIED"
    CASE_CLOSED = "CASE_CLOSED"
    CASE_REOPENED = "CASE_REOPENED"
    CASE_REJECTED = "CASE_REJECTED"
    SLA_WARNING = "SLA_WARNING"
    SLA_BREACHED = "SLA_BREACHED"
    # Monitoring: kabul edilmeyen gorev icin baska personel onerisi (E5-10)
    REASSIGN_RECOMMENDED = "REASSIGN_RECOMMENDED"
    ESCALATED = "ESCALATED"
    DECISION_OVERRIDDEN = "DECISION_OVERRIDDEN"
    COMMENT_ADDED = "COMMENT_ADDED"
    FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED"


class AttachmentKind(StrEnum):
    # REPORT: bildirim yapanin fotografi; EVIDENCE: personelin is bitti kaniti
    REPORT = "REPORT"
    EVIDENCE = "EVIDENCE"


class TaskStatus(StrEnum):
    # Gecisler: docs/WORKFLOW.md bolum 2; case ile senkron bolum 1 tablosu
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class SlaStatus(StrEnum):
    # DB'de saklanmaz; okuma aninda due_at ile simdiki zamandan hesaplanir (ARCHITECTURE bolum 6)
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    BREACHED = "BREACHED"


class AutonomyLevel(StrEnum):
    """Agent'in ne kadar kendi karar verecegi (docs/AGENTS.md bolum 5)."""

    L1_AUTONOMOUS = "L1_AUTONOMOUS"  # karar verir ve uygular
    L2_NOTIFY = "L2_NOTIFY"  # uygular, manager bilgilendirilir
    L3_ESCALATE = "L3_ESCALATE"  # insan karar verir


class PolicyScope(StrEnum):
    """agent_policies satirinin kapsami: tek bir bildirim tipi ya da bir kategori."""

    CASE_TYPE = "CASE_TYPE"
    CATEGORY = "CATEGORY"


class OverrideField(StrEnum):
    """Manager'in duzeltebildigi agent ciktilari (POST /cases/{id}/override)."""

    CASE_TYPE = "case_type"
    PRIORITY = "priority"
    DEPARTMENT = "department"
