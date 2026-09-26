# CampusFlow AI — Kod Yazma Kuralları

Bu kurallar **bağlayıcıdır**: ekip üyesinin elle yazdığı ya da bir AI asistanına (Claude Code, Copilot,
Cursor…) yazdırdığı **tüm** Python, TypeScript, SQL ve YAML kodu için geçerlidir. Kurallara uymayan
PR merge edilmez. Kod yazmaya başlamadan **önce** okunur.

Kaynak: Endüstriyel bir Odoo projesinin kod inceleme deneyiminden çıkan kurallar, bu projenin
yığınına (FastAPI + Next.js + scikit-learn) uyarlandı. Stil ayrıntıları: [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

---

## 1. Fail fast — hata gizlenmez

Sistemin patlaması gerekiyorsa o an patlasın; sessizce yutulan hata kaybolmaz, sadece saklanır ve
teşhis edilemez hale gelir.

- Boş `except: pass`, `except Exception: return None`, `catch {}` **yasak**.
- Yalnızca **beklenen, dar** hata yakalanır ve yakalandığı yerde **somut bir karşılığı** vardır
  (ör. `IntegrityError` → `ConflictError`). "Hata olursa ne yapacağım?" sorusunun cevabı yoksa `try` yazılmaz.
- Programlama hataları (`TypeError`, `KeyError`, `AttributeError`) asla maskelenmez.
- Hata üst katmana domain exception olarak iletilir; HTTP'ye çeviren **tek yer** merkezi exception handler'dır.
- Frontend'de API hatası kullanıcıya gösterilir (toast/hata durumu), sessizce boş liste çizilmez.

```python
# YANLIS — model yuklenemezse sistem "OTHER" der, kimse fark etmez
try:
    label = classifier.predict(text)
except Exception:
    label = "OTHER"
```

```python
# DOGRU — fallback bilincli bir tasarim karari; loglanir ve karara gerekce olarak yazilir
if not classifier.is_loaded:
    logger.warning("classifier model missing, using rule fallback", extra={"model_path": path})
    return rule_classifier.predict(text).with_reason(ReasonCode.FALLBACK_USED)
return classifier.predict(text)
```

> **Tek istisna — AI fallback:** "LLM/model yoksa kurala düş" davranışı bir **tasarım kararıdır**
> (bkz. docs/AGENTS.md). Bu durumda bile hata yutulmaz: `logger.warning` + `FALLBACK_USED` gerekçesi zorunludur
> ve fallback yolu ayrı testle kapsanır.

---

## 2. Az dallanma

Her `if`/`try` yeni bir yol açar: 3 if = 8 yol, 5 if = 32 yol. Hatalar test edilmemiş yollarda yaşar.

- İç içe en fazla **2 seviye**. Fonksiyon başına **4'ten fazla** `if/for/try` varsa eksik bir soyutlama vardır.
- Fonksiyon ~40 satırı geçiyorsa bölünür.

| Yerine | Bunu kullan |
|---|---|
| İç içe `if` | **Guard clause** (erken `return` / `raise`) |
| Uzun `if-elif` zinciri | **dict / tablo** (`ALLOWED_TRANSITIONS`, `PRIORITY_BANDS`, Supervisor karar tablosu) |
| Döngü içinde filtre `if`'i | comprehension / `filter` / SQL `WHERE` |
| Rol kontrolü için `if user.role == ...` her yerde | `require_roles(...)` dependency + `authorization.py` |
| Savunma amaçlı `try` | Hiçbir şey |

Bu projede state machine, SLA eşleşmesi, priority bantları ve Supervisor kararları **veri tablosu**
olarak yazılır; kural eklemek = tabloya satır eklemek.

---

## 3. İsimlendirme İngilizce, yorum Türkçe (ASCII)

- Değişken, fonksiyon, sınıf, dosya, tablo, kolon, endpoint, enum adları **İngilizce**.
- Türkçe kök + İngilizce ek karışımı yapılmaz: `gorev_ids` ❌ → `task_ids` ✅.
- Kod yorumları ve docstring'ler **Türkçe**, ama **ASCII**: `ç ğ ı ö ş ü` yerine `c g i o s u`.
  Gerekçe: Windows'ta yazılan Türkçe karakter Linux Docker konteynerinde / terminalde bozulabiliyor.
- Kullanıcının gördüğü metinler (UI etiketleri, hata mesajları, bildirimler, e-posta) **tam Türkçe**,
  Türkçe karakterli kalır. Backend'deki kullanıcıya dönük mesajlar tek yerde toplanır (`core/messages.py`).
- İstisna: ML eğitim verisi ve Türkçe anahtar kelime sözlükleri (`keywords`, `aliases`) doğal olarak
  Türkçe karakter içerir — bunlar veridir, yorum değildir.

```python
# Supervisor karar tablosunu sirayla degerlendir, ilk eslesen kazanir   <- DOGRU
# Supervisor karar tablosunu sırayla değerlendir                         <- YANLIS
```

---

## 4. TDD — önce test, sonra kod

1. **Kırmızı** — beklenen davranışı tanımlayan başarısız test.
2. **Yeşil** — testi geçirecek **en az** kod.
3. **Temizle** — testler yeşilken sadeleştir.

- **Hata düzeltirken de aynı sıra:** önce hatayı yakalayan test (kırmızı olmalı; olmuyorsa hata yanlış anlaşılmıştır).
- Test kodun parçasıdır; testsiz iş mantığı PR'ı kabul edilmez.
- Zorunlu test alanları: workflow geçişleri, SLA, priority, routing, duplicate, supervisor, yetki (RBAC/IDOR), analytics hesapları.

---

## 5. Önce spec, sonra kod

Bir özelliğe başlamadan önce kapsam **yazılı** netleşir (issue ya da PR açıklaması). Önemli işlerde plan
dört satır içerir:

```yaml
invariant:    "Bir case'in ayni anda en fazla 1 aktif task'i olur"
assumption:   "MVP'de her case tek departmanca cozulur"      # dogrulanmadi: gercek veride kontrol edilecek
risk:         "Iki staff ayni anda kabul ederse cift atama"
verification: "test_accept_task_is_atomic (tests/integration/test_tasks.py)"
```

Doğrulanmamış varsayım öyle işaretlenir; sessizce doğru kabul edilmez. Mimaride değişiklik gerekiyorsa
önce `docs/` güncellenir, sonra kod yazılır.

---

## 6. Ölü kod bırakılmaz

Kullanılmayan import/fonksiyon/bileşen/endpoint, yorum satırına alınmış eski kod, kodla çelişen yorum
temizlenir. **Dokunduğun dosyada** bu kurallara aykırı eski kod varsa onu da düzeltirsin.
Yorum satırına alınmış kod yerine git geçmişi vardır.

---

## 7. Sihirli sayı nedeniyle yazılır

Eşik ve ağırlıklar bir **karardır**; tek bir yerde (`core/constants.py`, DB'deki policy/SLA tabloları,
ya da config) ve nedeniyle birlikte durur.

```python
# 0.80 ustu: seed verisinde bilinen duplicate kumelerinde precision 0.95 (ai/models/campus/metrics.json)
DUPLICATE_MERGE_THRESHOLD = 0.80
# Recurring esigi: 30 gunde 5+ ayni lokasyon+tip; yonetici toplantisi karari (docs/ANALYTICS.md)
RECURRING_MIN_COUNT = 5
```

---

## 8. İddia kaynak gösterir

Bir kütüphanenin davranışı, bir KPI'nın anlamı, modelin başarısı hakkında yazılan her iddia
**dosya:satır**, doküman linki ya da **tekrar çalıştırılabilir komut çıktısı** ile desteklenir.
Tezdeki her sayı (accuracy, automation rate…) bir script/endpoint çıktısına dayanır; elle yazılmaz.

---

## 9. Kontrolün çalıştığı kanıtlanır

Her gün geçen bir test tek başına bir şey kanıtlamaz; bozuk kontrol de her şeyi geçirir.

- Yeni test/kısıt/doğrulama önce **bilerek bozuk girdiyle kırmızıya** döndürülür, sonra yeşile.
- CI çıktısında **test sayısı** kontrol edilir; beklenenden azsa sonuç yeşil sayılmaz
  (pytest `--co -q` ile toplanan test sayısı PR'da belirtilir).
- Model metrikleri için: rastgele etiketle eğitilen model macro-F1'de belirgin düşmeli (sanity check).

---

## 10. Tuhaf koda dokunmadan önce nedenini sor

Garip görünen bir dal çoğu zaman bir yük taşır. Silmeden önce: git geçmişi / PR / yazan kişi.
Nedeni bulunamazsa mevcut davranış bir **karakterizasyon testi** ile sabitlenir, sonra değiştirilir.

---

## 11. İsraf yok

Tek uygulaması olan soyutlama, hiç değişmeyen değer için ayar, ikinci kullanıcısı olmayan uzantı
noktası kurulmaz. Yeni kütüphane/servis ancak somut ihtiyaç kanıtlanınca eklenir (bkz. ARCHITECTURE ADR-1, ADR-8).
**İstisna:** docs/AGENTS.md'deki provider arayüzleri (kural/ML/LLM) bilinçli bir karardır — üçünün de uygulaması var.

---

## 12. Düzeltme ne kapattığını söyler

Bug fix PR'ı iki şeyden hangisi olduğunu belirtir:

- **Örnek düzeltme** — bu kaydı/bu durumu düzeltir; hata sınıfı yaşamaya devam eder.
- **Sınıf kapatma** — hatanın bir daha oluşamamasını sağlar (DB kısıtı, sınırda doğrulama, test).

Kök neden "5 Neden" ile aranır; düzeltmeden sonra tekrarı ölçülür.

---

## 13. Katman sınırları (projeye özgü)

- Route (`api/`) yalnızca: doğrulama, yetki dependency, servis çağrısı, yanıt. **İş kuralı ve SQL yok.**
- Agent'lar DB'ye erişmez, yazmaz; `AgentContext` alır, `AgentResult` döner.
- Status değişikliği **yalnızca** `WorkflowService.transition()` ile; event aynı transaction'da.
- Analytics Agent SQL üretmez; yalnızca backend'in hesapladığı KPI JSON'unu kullanır.
- React bileşeninde iş kuralı yok; hesaplama `lib/` altında saf fonksiyon + test.
- Şema değişikliği yalnızca Alembic migration ile. Veri silen migration ekip onayı olmadan yazılmaz.

## 14. Güvenlik (projeye özgü)

- ID ile gelen her kaynak sahiplik kontrolünden geçer (`authorization.py`); yetkisizse **404**.
- Secret, parola, token, tam kişisel veri log'a ve repoya yazılmaz.
- Dosya yükleme: magic byte + uzantı + boyut kontrolü.
- Kullanıcı girdisi ham SQL'e string ile eklenmez (yalnız SQLAlchemy parametreleri).

---

## Kural künyesi

Her kural hangi düzeyde uygulandığını dürüstçe söyler. Güçlüden zayıfa:
*tip/DB kısıtı > başarısız test > CI kapısı > lint > yazılı kural + review*.

| # | Kural | Uygulama düzeyi (FAZ 1'de kuruldu: `backend/pyproject.toml`, `frontend/eslint.config.mjs`, `ci.yml`) |
|---|---|---|
| 1 | Fail fast | Lint: ruff `BLE001` (blind except), `S110`/`S112` (try-except-pass/continue), `E722`; ESLint `no-empty` + review |
| 2 | Az dallanma | Lint: ruff `C901` (max-complexity 8), `PLR0912` (branches), ESLint `complexity: 8`, `max-depth: 3` |
| 3 | İngilizce isim | Review (+ ileride tarama betiği) |
| 3b | ASCII yorum | CI: `scripts/check_ascii_comments.py` (tüm ASCII dışı karakterler; `§` dahil) |
| 4 | TDD | Review + CI'da coverage raporu (kritik modüller ≥ %85) |
| 5 | Önce spec | PR şablonu alanı + review |
| 6 | Ölü kod | Lint: ruff `F401`, `F841`, `ERA001` (commented-out code); ESLint `no-unused-vars`, ts `noUnusedLocals` |
| 7 | Sihirli sayı | Lint: ruff `PLR2004` (backend/app ve ai/ için; testlerde kapalı) |
| 8 | İddia kaynak gösterir | Review |
| 9 | Kontrol kanıtlanır | PR şablonu: "kırmızıya döndürdüm" onayı + test sayısı |
| 10 | Tuhaf kodun nedeni | Review |
| 11 | İsraf yok | Review |
| 12 | Düzeltme etiketi | PR şablonu alanı |
| 13 | Katman sınırları | Review (+ ileride import-linter) |
| 14 | Güvenlik | Integration testleri (IDOR, upload) + ruff `S` kuralları |

Bir kural sürekli ihlal ediliyorsa yalnızca kodu değil **kuralı da** sorgulayın: yanlış ya da
uygulanamaz olabilir. Kural değişikliği PR ile yapılır ve ekipçe onaylanır.
