# WORKFLOW — State Machine & RBAC

## 1. Case State Machine

```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> ANALYZING : pipeline başladı
    ANALYZING --> CLASSIFIED : otomatik / insan incelemesi gerekli
    ANALYZING --> NEEDS_INFO : REQUEST_MORE_INFO
    ANALYZING --> MERGED : MERGE_WITH_EXISTING_CASE
    ANALYZING --> ESCALATED : L3 / ESCALATE
    ANALYZING --> REJECTED : spam / geçersiz
    NEEDS_INFO --> ANALYZING : reporter bilgi ekledi
    NEEDS_INFO --> REJECTED : 48 saat yanıt yok (henüz uygulanmadı)
    CLASSIFIED --> ASSIGNED : task oluşturuldu
    CLASSIFIED --> ESCALATED
    CLASSIFIED --> MERGED
    CLASSIFIED --> REJECTED
    ESCALATED --> ASSIGNED : manager karar verdi
    ESCALATED --> MERGED
    ESCALATED --> REJECTED
    ASSIGNED --> ACCEPTED : staff kabul
    ASSIGNED --> ASSIGNED : yeniden atama
    ASSIGNED --> ESCALATED : staff reddetti / kimse yok
    ACCEPTED --> IN_PROGRESS
    ACCEPTED --> ASSIGNED : yeniden atama
    ACCEPTED --> ESCALATED
    IN_PROGRESS --> RESOLVED : staff tamamladı
    IN_PROGRESS --> ESCALATED : yetki dışı iş
    RESOLVED --> VERIFICATION : Resolution Agent
    VERIFICATION --> CLOSED : resolved
    VERIFICATION --> IN_PROGRESS : needs_more_evidence
    VERIFICATION --> REOPENED : reopen
    CLOSED --> REOPENED : reporter (72 saat içinde)
    REOPENED --> ASSIGNED
    REOPENED --> ESCALATED
    CLOSED --> [*]
    REJECTED --> [*]
    MERGED --> [*]
```

### Kurallar

- Geçişler `backend/app/services/workflow.py` içinde **tek bir tablo** (`ALLOWED_TRANSITIONS: dict[CaseStatus, set[CaseStatus]]`)
  olarak tanımlanır. Tablo dışı geçiş `InvalidTransitionError` → HTTP 409.
- Her geçiş: ilgili zaman damgası (`assigned_at`…) + `case_events` kaydı aynı transaction'da.
- Zaman damgaları **ilk** gerçekleşmede yazılır. İstisna: reopen sonrası `resolved_at` ve `closed_at` güncellenir
  (SLA son çözüme göre ölçülür; reporter'ın 72 saatlik itiraz/puan penceresi son kapanıştan başlar). İlk değerler
  event log'da korunur.
- `ESCALATED` **durumu** = manager karar kuyruğu (atama öncesi risk). SLA gecikmesi escalation'ı ise
  status'u değiştirmez; `escalation_level` artar + `ESCALATED` event yazılır. Böylece devam eden iş bozulmaz.
- Terminal durumlar: `CLOSED` (reopen penceresi hariç), `REJECTED`, `MERGED`.
- `REOPENED` → `reopened_count += 1`.

### Case ↔ Task senkronizasyonu

Uygulama: `backend/app/services/task_service.py`. ✅ **E5-11:** tamamlanan görevi Resolution Agent doğrular
(`services/resolution_service.py`, [AGENTS.md](AGENTS.md) 4.9); FAZ 4'teki geçici otomatik kapatma kaldırıldı.
`RESOLVED → VERIFICATION` sonrası: `RESOLVED` → `CLOSED`; kanıt yetersiz → görev ve bildirim `IN_PROGRESS`'e döner
(`EVIDENCE_REQUESTED`, eksik metadata'da), ikinci kez yetersizse `VERIFICATION` + `needs_human_review` (manager
`POST /cases/{id}/close` ile kapatır ya da yeniden açar); notta "yapılamadı" → `REOPENED → ESCALATED` (personel
ataması kalkar, manager yeniden atar). Agent hattı kapalıysa (`AGENTS_ENABLED=false`) bildirim `VERIFICATION` +
`needs_human_review` ile manager'ı bekler. Agent hattı (E5-8b) bildirimi kendisi sınıflandırıp
atar (docs/AGENTS.md bölüm 3); hat kapalıysa (`AGENTS_ENABLED=false`) ya da manager el koyarsa, manager ataması
`ANALYZING` bildirimi önce `CLASSIFIED` yapar (`ROUTED`, elle yönlendirme). Reddedilen görevde bildirim `ESCALATED`
olur (manager yeniden atar; otomatik yeniden yönlendirme ileride).

| Task olayı | Task status | Case status |
|---|---|---|
| Task oluşturuldu | PENDING | ASSIGNED |
| Staff kabul etti | ACCEPTED | ACCEPTED |
| Staff başladı | IN_PROGRESS | IN_PROGRESS |
| Staff tamamladı | COMPLETED | RESOLVED → VERIFICATION → (Resolution Agent) CLOSED / IN_PROGRESS / ESCALATED |
| Kanıt yetersiz (Resolution) | IN_PROGRESS | IN_PROGRESS |
| Staff reddetti | DECLINED | ASSIGNED (yeni task) veya ESCALATED |
| Case merge/reject | CANCELLED | MERGED / REJECTED |

## 2. Task State Machine

```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
PENDING → DECLINED | CANCELLED
ACCEPTED → DECLINED | CANCELLED
IN_PROGRESS → CANCELLED
COMPLETED → IN_PROGRESS   (Resolution Agent kanıt istedi, E5-11)
```

## 3. Event Tipleri

`CASE_CREATED, ANALYSIS_STARTED, AI_CLASSIFIED, DUPLICATE_CHECKED, VERIFICATION_SCORED,
PRIORITY_CALCULATED, ROUTED, SUPERVISOR_DECIDED, HUMAN_REVIEW_REQUESTED, INFO_REQUESTED, INFO_PROVIDED,
CASE_MERGED, TASK_CREATED, TASK_ACCEPTED, TASK_DECLINED, TASK_REASSIGNED, WORK_STARTED, WORK_COMPLETED,
EVIDENCE_UPLOADED, RESOLUTION_EVALUATED, EVIDENCE_REQUESTED, RESOLUTION_VERIFIED, CASE_CLOSED, CASE_REOPENED, CASE_REJECTED,
SLA_WARNING, SLA_BREACHED, REASSIGN_RECOMMENDED, ESCALATED, DECISION_OVERRIDDEN, COMMENT_ADDED, FEEDBACK_SUBMITTED`

`metadata_json` örneği (`PRIORITY_CALCULATED`):
```json
{"decision_id": 812, "priority": "HIGH", "impact_score": 72}
```

## 4. RBAC Matrisi

✅ = izinli · 🔸 = yalnızca sahiplik/kapsam dahilinde · ❌ = yasak

| İşlem | REPORTER | STAFF | MANAGER | ADMIN |
|---|:-:|:-:|:-:|:-:|
| Case oluşturma | ✅ | ✅ | ✅ | ✅ |
| Case görüntüleme | 🔸 kendi | 🔸 kendine atanmış + departmanı | ✅ | ✅ |
| Case'e fotoğraf ekleme | 🔸 kendi | 🔸 atanmış (kanıt) | ✅ | ❌ |
| Public yorum | 🔸 kendi | 🔸 atanmış | ✅ | ❌ |
| Internal yorum görme/yazma | ❌ | 🔸 | ✅ | ❌ |
| Geri bildirim / reopen | 🔸 kendi, kapanıştan 72 sa. | ❌ | ✅ | ❌ |
| Task listeleme | ❌ | 🔸 kendi | ✅ | ✅ (salt okuma) |
| Task kabul/başlat/tamamla/reddet | ❌ | 🔸 kendi | ❌ | ❌ |
| Case (yeniden) atama | ❌ | ❌ | ✅ | ❌ |
| Ek bilgi isteme (`request-info`) | ❌ | ❌ | ✅ | ❌ |
| Ek bilgiyi yanıtlama (`info`) | 🔸 kendi | ❌ | ❌ | ❌ |
| Agent kararını düzeltme (override) | ❌ | ❌ | ✅ | ❌ |
| Human review kuyruğu | ❌ | ❌ | ✅ | ❌ |
| Escalated case kararı | ❌ | ❌ | ✅ | ❌ |
| Case reject/merge (manuel) | ❌ | ❌ | ✅ | ❌ |
| Dashboard / analytics / agent metrikleri | ❌ | ❌ | ✅ | ✅ |
| AI yönetim özeti | ❌ | ❌ | ✅ | ✅ |
| Agent karar geçmişi | ❌ | ❌ | ✅ | ✅ |
| Kullanıcı / departman / lokasyon / case type / SLA / agent policy yönetimi | ❌ | ❌ | ❌ | ✅ |
| Audit log görüntüleme | ❌ | ❌ | ❌ | ✅ |

**Notlar**
- Admin operasyonel karar vermez (görev ayrılığı — YBS iç kontrol ilkesi).
- MANAGER MVP'de tüm organizasyonu görür; departman bazlı kısıt ileride `department_id` ile eklenebilir.
- IDOR koruması: ID ile gelen her kaynak `services/authorization.py` içindeki `can_view_case(user, case)`
  benzeri fonksiyonlardan geçer; erişim yoksa **404** (varlık sızdırılmaz).
