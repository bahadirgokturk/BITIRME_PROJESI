# UI_GUIDE — Tasarım Rehberi (Figma → Next.js)

Bu rehber CampusFlow AI arayüzünü tasarlayan ve kodlayan herkes içindir. Hedef: **kullanıcı dostu**, tutarlı,
erişilebilir ve Figma'da çizilenle koddaki ekranın **aynı** olduğu bir arayüz.
Kod kuralları için [KOD_KURALLARI.md](../KOD_KURALLARI.md) ve [CONVENTIONS.md](CONVENTIONS.md) geçerlidir.

## 1. Tasarım İlkeleri

1. **Kullanıcıyı AI ile uğraştırma.** Kategori, öncelik, departman seçtirmeyiz; bunları agent'lar bulur.
   Reporter yalnızca "ne oldu, nerede" der.
2. **Önce görev, sonra süs.** Her ekranın tek bir ana işi vardır; ana buton ekranda en belirgin öğedir.
3. **AI kararı her zaman açıklanır.** Otomatik verilen her karar için "neden?" bir tık uzaklıktadır (güven skoru + gerekçeler).
4. **Durum renk + metinle gösterilir.** Renk körü bir kullanıcı da durumu okuyabilmelidir.
5. **Hata saklanmaz.** Bir şey yüklenemediyse boş liste değil, anlaşılır bir hata ve "Tekrar dene" gösterilir.
6. **Türkçe ve sade.** Teknik terim (case, SLA, agent) yalnız yönetici ekranlarında; reporter "bildirim", "talep" görür.

## 2. Kullanıcılar, Cihazlar ve Ekranlar

| Rol | Tipik kullanıcı | Cihaz | Başarı ölçütü |
|---|---|---|---|
| **REPORTER** | Öğrenci, akademisyen, personel | 📱 Telefon (tek el, yürürken) | Bildirim **30 sn** içinde gönderilir |
| **STAFF** | Temizlik, teknik, BT görevlisi | 📱 Telefon (ayakta, eldivenli olabilir) | Görev 2 dokunuşla kabul/başlat/tamamla |
| **MANAGER** | Birim yöneticisi | 💻 Masaüstü | İnceleme kuyruğu tek ekranda karara bağlanır |
| **ADMIN** | Sistem yöneticisi | 💻 Masaüstü | Tanımlar (kullanıcı, lokasyon, SLA…) hızlıca düzenlenir |

Tasarım sırası: **REPORTER ve STAFF önce mobil** (375 px), sonra masaüstü; **MANAGER ve ADMIN önce masaüstü**
(1440 px), sonra tablet/mobil kırılımı.

### Ekran listesi (route = Figma frame adı)

| Route | Rol | Faz (kod) | Not |
|---|---|---|---|
| `/login` | herkes | FAZ 2 | Taslağı kodda var |
| `/` | herkes | FAZ 2 | Role göre yönlendirme (reporter → `/report`, staff → `/staff/tasks`, manager → `/manager/dashboard`) |
| `/admin/*` | ADMIN | FAZ 2 | users, departments, locations (ağaç), case-types, sla-rules, agent-policies, audit-logs |
| `/report` | herkes | FAZ 3 | **En kritik ekran** — bkz. bölüm 5.1 |
| `/my-cases` | REPORTER | FAZ 3 | Kendi bildirimleri |
| `/cases/[id]` | kapsam | FAZ 3 | Detay + zaman çizelgesi (reporter'a sadeleştirilmiş) |
| `/staff/tasks`, `/staff/tasks/[id]` | STAFF | FAZ 4–7 | Görev listesi ve yaşam döngüsü |
| `/manager/review-queue` | MANAGER | FAZ 7 | AI'ın emin olmadığı / escalate edilen kayıtlar |
| `/manager/cases` | MANAGER | FAZ 7 | Filtreli liste |
| `/manager/dashboard`, `/manager/analytics` | MANAGER, ADMIN | FAZ 9–10 | KPI kartları, grafikler |
| `/manager/agents` | MANAGER, ADMIN | FAZ 10 | Agent performansı |

Rol bazlı menü kodda tek tabloda durur: `frontend/src/lib/navigation.ts`. Menü değişikliği Figma'da ve bu tabloda birlikte yapılır.

## 3. Figma Dosyası Kurulumu

- **Başlangıç kiti:** Topluluktaki bir **shadcn/ui Figma kiti** ile başlayın. Kodda shadcn/ui kullanıldığı için
  Figma'daki her bileşenin koddaki karşılığı hazırdır (Button, Card, Input, Label, Dialog, Table, Badge, Tabs…).
  Kitte olmayan bir bileşen çizmeden önce shadcn'de karşılığı var mı bakın.
- **Sayfalar:** `00 Kapak` · `01 Foundations` (renk, tipografi, boşluk, ikon) · `02 Components` ·
  `03 Reporter` · `04 Staff` · `05 Manager` · `06 Admin` · `07 Prototype`.
- **Frame adları route adıdır:** `/report — mobil`, `/manager/dashboard — masaüstü`. Kod ile eşleşmeyi kolaylaştırır.
- **Frame genişlikleri:** mobil 375, tablet 768, masaüstü 1440.
- **Her ekranın durumları** ayrı frame olarak çizilir: normal · yükleniyor · boş · hata · başarı (bkz. bölüm 7).
- **Veri notu:** Her ekranın yanına "bu ekran hangi veriyi gösteriyor" notu düşülür (alan adlarıyla). Backend
  bu notlardan endpoint şemasını çıkarır (bölüm 9).

## 4. Tasarım Token'ları

Figma değişkenleri (Variables) **koddaki CSS değişkenleriyle aynı adla** tanımlanır
(`frontend/src/app/globals.css`). Böylece renk değişikliği tek yerde yapılır.

| Figma değişkeni | CSS değişkeni | Kullanım |
|---|---|---|
| `background` / `foreground` | `--background` / `--foreground` | Sayfa zemini / ana metin |
| `primary` / `primary-foreground` | `--primary` / `--primary-foreground` | Ana buton, vurgu |
| `muted` / `muted-foreground` | `--muted` / `--muted-foreground` | İkincil zemin, açıklama metni |
| `destructive` | `--destructive` | Silme, hata |
| `border`, `input`, `ring` | `--border`, `--input`, `--ring` | Çerçeve, form alanı, odak halkası |
| `chart-1 … chart-5` | `--chart-1 … --chart-5` | Grafik serileri |
| `radius` | `--radius` (0.625rem = 10 px) | Köşe yuvarlaklığı |

- **Marka rengi:** Şu an shadcn'in nötr (siyah-gri) teması var. Ekip bir marka rengi seçerse yalnız
  `primary` (ve gerekirse `chart-*`) değişir; açık ve koyu tema için ikişer değer verilir.
- **Tipografi:** Geist (kodda yüklü, Türkçe karakter destekli). Ölçek: 12 · 14 (gövde) · 16 · 20 · 24 · 30 px.
  Mobilde gövde metni en az 14 px, form alanları 16 px (iOS'ta otomatik zoom'u önler).
- **Boşluk:** Tailwind 4 px ızgarası (4, 8, 12, 16, 24, 32, 48). Figma'da auto-layout boşlukları bu değerlerden seçilir.
- **İkonlar:** [Lucide](https://lucide.dev) (kodda kurulu). Figma'da da Lucide ikon seti kullanılır.

### 4.1 Durum, öncelik ve SLA gösterimi

Değerler backend enum'larıdır ([DATABASE.md](DATABASE.md) bölüm 2); etiket ve renk eşlemesi kodda **tek dosyada**
(`frontend/src/lib/status.ts`) tutulur. Figma'daki Badge bileşeni bu tabloyla birebir çizilir.
Renkler öneridir; ekip değiştirebilir ama tabloyu ve kodu birlikte günceller.

| `case_status` | Etiket (manager/staff) | Renk |
|---|---|---|
| NEW | Yeni | gri |
| ANALYZING | Analiz ediliyor | mavi |
| NEEDS_INFO | Bilgi bekleniyor | amber |
| CLASSIFIED | Sınıflandırıldı | mavi |
| ASSIGNED | Atandı | indigo |
| ACCEPTED | Kabul edildi | indigo |
| IN_PROGRESS | Çalışılıyor | mor |
| RESOLVED | Çözüldü | yeşil |
| VERIFICATION | Doğrulamada | yeşil (açık) |
| CLOSED | Kapandı | gri (koyu) |
| REOPENED | Yeniden açıldı | amber |
| ESCALATED | Yöneticiye iletildi | kırmızı |
| REJECTED | Reddedildi | gri (üstü çizili değil, ikonlu) |
| MERGED | Birleştirildi | gri |

**Reporter için sadeleştirilmiş ilerleme** (öneri): 14 durum yerine 4 adımlı bir ilerleme çubuğu —
**Alındı** (NEW, ANALYZING, CLASSIFIED) → **Yönlendirildi** (ASSIGNED, ACCEPTED) → **Çalışılıyor** (IN_PROGRESS)
→ **Çözüldü** (RESOLVED, VERIFICATION, CLOSED). NEEDS_INFO, REJECTED ve MERGED ayrı bilgi kutusuyla anlatılır
("Konumu netleştirebilir misiniz?", "Aynı sorun zaten bildirilmiş, oraya eklendi").

| `priority` | Etiket | Renk | | SLA durumu | Etiket | Renk |
|---|---|---|---|---|---|---|
| LOW | Düşük | gri | | ON_TRACK | Zamanında | yeşil |
| MEDIUM | Orta | mavi | | AT_RISK (%75) | Riskte | amber |
| HIGH | Yüksek | turuncu | | BREACHED | Gecikti | kırmızı |
| CRITICAL | Kritik | kırmızı + ikon | | | | |

## 5. Rol Bazlı Ekran Kuralları

### 5.1 Reporter — `/report` (en kritik ekran)

- **Tek ekran, üç alan:** "Ne oldu?" (çok satırlı metin, örnek placeholder: *"B blok 2. kat erkek tuvalette sabun bitmiş"*),
  **Konum**, **Fotoğraf (isteğe bağlı)**. Kategori/öncelik alanı **yok**.
- **Konum seçici:** Arama kutusu (lokasyon adı ve takma adlarıyla eşleşir: "b2 wc") + son kullanılan konumlar.
  Kampüs → Bina → Kat → Alan ağacı ikincil yol olarak sunulur. Metinde konum geçiyorsa AI önerir, kullanıcı onaylar.
- **Fotoğraf:** Kamera veya galeri; jpg/png/webp, en fazla 5 MB. Yükleme sırasında önizleme ve ilerleme.
- **Gönder butonu** ekranın altında, başparmak erişiminde, tam genişlik.
- **Onay ekranı:** Bildirim numarası (`CASE-000124`), "Bildiriminiz alındı, inceleniyor" ve "Bildirimlerim" bağlantısı.
- Başarı ölçütü: yeni bir kullanıcı ilk denemesinde 30 sn içinde gönderebilmeli (ekip içi kullanılabilirlik testi, bölüm 10).

### 5.2 Reporter — `/my-cases`, `/cases/[id]`

- Liste kartı: kısa metin, konum, tarih, **4 adımlı ilerleme** (bölüm 4.1).
- Detay: zaman çizelgesi reporter'a sade dilde ("Temizlik birimine yönlendirildi", "Görevli çalışmaya başladı").
  Agent adları, güven skorları, iç notlar reporter'a **gösterilmez**.
- Kapanıştan sonra 1–5 yıldız geri bildirim ve 72 saat içinde "Sorun devam ediyor" (reopen).

### 5.3 Staff — `/staff/tasks`, `/staff/tasks/[id]`

- Liste sıralaması: SLA'ya kalan süre (en acil üstte). Kartta **konum** en büyük metin, sonra iş tanımı ve kalan süre.
- Ana eylem butonu duruma göre tek ve büyük: **Kabul et** → **Başlat** → **Tamamla**. Dokunma alanı en az 44×44 px.
- Tamamla: not (isteğe bağlı) + kanıt fotoğrafı. Reddetme (decline) ikincil buton ve gerekçe ister.

### 5.4 Manager

- **İnceleme kuyruğu:** Her satırda AI önerisi (tip, öncelik, departman), güven skoru ve **neden buraya düştü**
  (düşük güven / olası tekrar / güvenlik). Satırdan çıkmadan: onayla · düzelt (override) · birleştir · reddet.
- **AI karar gerekçe paneli** (projenin en özgün bileşeni): her agent için karar, güven (yüzde + çubuk), gerekçe maddeleri
  (ör. "‘kıvılcım’ kelimesi → güvenlik +30"), kullanılan model (`tfidf-logreg@…`, `rules@1.0`). Düzeltme yapılırsa
  gerekçe zorunludur; bu kayıt modelin yeniden eğitimi için veri olur.
- **Dashboard:** üstte 4–6 KPI kartı (açık kayıt, SLA uyumu, ortalama çözüm süresi, otomasyon oranı), altında trend
  ve dağılım grafikleri. Her grafik başlığı sorunun cevabını söyler ("Bu hafta en çok sorun: B Blok").

### 5.5 Admin

- Tek kalıp: arama + filtre + tablo + sağdan açılan düzenleme paneli (Sheet). Silme yok; **Pasifleştir** (soft delete).
- Lokasyonlar ağaç görünümünde (Kampüs → Bina → Kat → Alan).

## 6. Metin ve Dil

- Arayüz metinleri **tam Türkçe** ve Türkçe karakterli ("Gönder", "Bildirimlerim"). Cümle düzeninde yazılır
  ("Bildirim yap", "Bildirim Yap" değil).
- Butonlar fiildir: "Gönder", "Kabul et", "Tamamla". "Tamam/Evet" yerine eylemi söyleyen metin.
- Hata mesajları backend'den `error.message` olarak gelir ([API.md](API.md): `{"error": {code, message, details}}`);
  frontend bunları olduğu gibi gösterir, kendisi uydurmaz. Alan hataları ilgili alanın altında gösterilir.
- Tarih/saat Europe/Istanbul, göreli ("12 dk önce") + üzerine gelince tam tarih.

## 7. Her Ekranın Durumları

Her ekran ve liste için Figma'da ve kodda şu durumlar çizilir/uygulanır:

| Durum | Ne gösterilir |
|---|---|
| Yükleniyor | İskelet (skeleton) — içerik şeklinde gri bloklar; spinner yalnız butonlarda |
| Boş | Açıklama + bir sonraki adım ("Henüz bildiriminiz yok. **Bildirim yap**") |
| Hata | Anlaşılır mesaj + "Tekrar dene"; **asla sessiz boş liste** (KOD_KURALLARI kural 1) |
| Başarı | Kısa toast ("Görev tamamlandı") veya onay ekranı |
| Yetkisiz / bulunamadı | Aynı "Kayıt bulunamadı" ekranı (güvenlik: varlık sızdırılmaz) |

## 8. Erişilebilirlik (WCAG 2.2 AA)

- Metin kontrastı en az 4.5:1 (büyük metin 3:1). Figma'da kontrast eklentisiyle kontrol edilir.
- Dokunma alanı en az 44×44 px; butonlar arası en az 8 px.
- Her form alanının görünür etiketi var (yalnız placeholder yetmez).
- Klavye ile tüm akış tamamlanabilir; odak halkası (`--ring`) görünür.
- Durum yalnız renkle değil, metin/ikonla da anlatılır (bölüm 4.1).
- Görsel ikonların metin karşılığı (`aria-label`) var; dekoratif ikonlar `aria-hidden`.

## 9. Backend ile Çalışma: Sözleşme Önce

Backend ve frontend birbirini **beklemez**. Her faz şöyle ilerler:

```mermaid
sequenceDiagram
    participant D as Tasarım (B/C, Figma)
    participant BE as Backend (A)
    participant FE as Frontend (B/C, Next.js)
    D->>BE: Ekranlar + "hangi veri" notları (bir faz önceden)
    BE->>BE: Endpoint şeması (Pydantic) — küçük PR, ilk gün
    BE-->>FE: develop'ta OpenAPI hazır
    FE->>FE: npm run gen:api → tipler; ekranlar (gerekirse sahte veri)
    BE->>BE: İş mantığı + pytest (paralel)
    FE->>BE: Haftalık demoda gerçek API ile entegrasyon
```

- API tipleri **elle yazılmaz**: backend çalışırken `cd frontend && npm run gen:api`. CI'daki `api-contract` job'u
  tiplerin güncel olmadığı PR'ı kırmızıya çevirir.
- Ekranda gerekip API'de olmayan bir alan fark edilirse backend'e issue/PR yorumu olarak yazılır; frontend tahmin edip uydurmaz.
- Backend kendi başına test edilir: pytest + `http://localhost:8000/docs` (Swagger "Try it out").

## 10. Figma → Kod

- **Dev Mode:** Geliştirici ölçü, renk değişkeni ve boşlukları Figma Dev Mode'dan okur.
- **AI ile kodlama (öneri):** Figma'nın resmi **MCP sunucusu** Claude Code'a bağlanırsa, Claude seçili frame'i okuyup
  shadcn/ui bileşenleriyle koda dökebilir. AI'ın yazdığı kod da KOD_KURALLARI'na tabidir ve test edilir.
- **Bileşen eşleme:** Figma'daki bileşen adı shadcn adıyla aynı tutulur (Button, Card, Badge…). Yeni bileşen
  gerekiyorsa önce `npx shadcn@latest add <ad>` ile eklenir, sonra özelleştirilir.
- **İş kuralı bileşende olmaz:** durum → renk eşlemesi `lib/status.ts`, rol → menü `lib/navigation.ts`, hesaplamalar
  `lib/` altında saf fonksiyon + Vitest testi (KOD_KURALLARI kural 13).

## 11. Tasarım Kontrol Listesi (Definition of Done — tasarım)

Bir ekran tasarımı "hazır" sayılmadan önce:

- [ ] Mobil ve masaüstü frame'leri var (rolün öncelikli cihazı önce)
- [ ] Yükleniyor · boş · hata · başarı durumları çizildi
- [ ] Yalnız token'lar kullanıldı (serbest hex renk yok), bileşenler kitten
- [ ] Durum/öncelik/SLA gösterimi bölüm 4.1 tablosuyla aynı
- [ ] "Bu ekran hangi veriyi gösteriyor" notu var ve backend ile gözden geçirildi
- [ ] Kontrast ve dokunma alanı kontrol edildi
- [ ] Ekip dışından biri (ör. bir arkadaş) prototipte ana görevi yardımsız tamamladı (hızlı kullanılabilirlik testi)
