# UI_GUIDE — Tasarım Rehberi (Figma → Next.js)

Bu rehber BakırçayFlow (eski adıyla CampusFlow AI) arayüzünü tasarlayan ve kodlayan herkes içindir. Hedef: **kullanıcı dostu**, tutarlı,
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
| `/my-cases` | herkes | FAZ 3 | Kendi bildirimleri (menüde "Bildirimlerim"; Açık/Çözülen filtresi yalnız REPORTER'da) |
| `/cases/[id]` | kapsam | FAZ 3 | Detay + zaman çizelgesi (reporter'a sadeleştirilmiş) |
| `/staff/tasks`, `/staff/tasks/[id]` | STAFF | FAZ 4–7 | Görev listesi ve yaşam döngüsü |
| `/manager/review-queue` | MANAGER | FAZ 7 | AI'ın emin olmadığı / escalate edilen kayıtlar |
| `/manager/cases`, `/manager/cases/[id]` | MANAGER, ADMIN | FAZ 7 | Tüm Bildirimler: filtreli liste ve detay |
| `/staff/cases`, `/staff/cases/[id]` | STAFF | E7-5 | Birim Bildirimleri: aynı liste ve detay, personelin kapsamıyla |
| `/manager/dashboard`, `/manager/analytics` | MANAGER, ADMIN | FAZ 9–10 | KPI kartları, grafikler |
| `/manager/agents` | MANAGER, ADMIN | FAZ 10 | Agent performansı |
| `/manager/departments`, `/manager/departments/[id]` | MANAGER, ADMIN | E7-5 | Birim Performansı: birim kartları, tikli birim filtresi, birim detayı |

Rol bazlı menü kodda tek tabloda durur: `frontend/src/lib/navigation.ts`. Menü değişikliği Figma'da ve bu tabloda birlikte yapılır.
Menüler: bildiren *Bildirim Yap · Bildirimlerim*; personel *Bildirim Yap · Görevlerim · Birim Bildirimleri · Bildirimlerim*;
müdür *Bildirim Yap · Genel Bakış · İnceleme Kuyruğu · Raporlar · Yapay Zekâ Performansı · Tüm Bildirimler · Bildirimlerim*;
yönetici *Bildirim Yap · Genel Bakış · Raporlar · Yapay Zekâ Performansı · Tüm Bildirimler · Bildirimlerim · Yönetim*.

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

- **Marka rengi (kesinleşti):** İzmir Bakırçay Üniversitesi renklerinden.
  | Token | Açık tema | Koyu tema | Kullanım |
  |---|---|---|---|
  | `primary`, `ring` | turkuaz `#00818D` (beyaz yazı 4.64:1) | `#00A5B5` (koyu yazı 6.65:1) | Ana buton, bağlantı, odak halkası, ilerleme çubuğu |
  | `brand-accent` | turuncu `#FF8901` | aynı | Süsleme (başlık altı çizgi, seçili menü çizgisi, logodaki bakır rengi su) ve **renk yolculuğu** (aşağıda). Metin ya da buton rengi olarak kullanılmaz |
  | `brand-accent-strong` | koyu turuncu `#D96A00` | aynı | Renk yolculuğunun en başı (1. yıldız) |
  | `primary-strong` | koyu turkuaz `#005F68` | `#00818D` | Renk yolculuğunun en sonu (5. yıldız) |
  | `primary-text` | koyu turkuaz `#005F68` | `#00A5B5` | Gri zeminde ya da turkuaz rozette turkuaz **yazı** (ana turkuaz orada 4.1–4.3:1 kalır); beyaz zemindeki bağlantılar `primary` |

  **Renk yolculuğu:** turuncu "yolda", turkuaz "çözüldü" demektir; soldan sağa turuncudan turkuaza geçilir.
  İlerleme çubuğu: Alındı ve Yönlendirildi turuncu, Çalışılıyor turuncudan turkuaza geçişli, Çözüldü turkuaz.
  Puan yıldızları: 1. koyu turuncu, 2. turuncu, 3. geçişli, 4. turkuaz, 5. koyu turkuaz. Bilgi yalnız renkle
  verilmez: aktif adım kalın yazılır, puan sözle de gösterilir ("4 / 5 · İyi").

  Diğer token'lar shadcn nötr temasında kalır. Logo: turkuazdan (`#00818D`) bakıra (`#FF8901`) yedi tonda yumuşak geçişli dalgalı su katmanları; tam ortada
  beyaz üniversite logosu. Su katmanlarında beyaz kullanılmaz (beyaz zeminde logo bölünmüş görünür). Yazı: "Bakırçay" metin renginde, "Flow" turkuaz. `public/brand/logo-art.svg` +
  `components/brand/Logo.tsx`; uygulama simgeleri `public/icons/` ve `src/app/icon.png`, `apple-icon.png`
  (Figma: 02 Components > Logo/Simge, Logo/Yatay).
- **Koyu mod:** Her ekran açık ve koyu temada çalışır; renkler `globals.css` içinde `:root` ve `.dark` altındadır
  (koyu temada durum renklerinin açık tonları, `--primary-strong` yerine ana turkuaz). Tema düğmesi (`ThemeToggle`)
  masaüstünde menünün altında "Çıkış yap"ın yanında, telefonda üst çubuğun sağ köşesinde, giriş ekranında sağ üstte.
  Açık temada güneş, koyu temada ay ve yıldız simgesi; simge dönerek değişir (hareket azaltma ayarında animasyonsuz).
  Ekran okuyucuya "Koyu mod" düğmesi ve basılı/basılı değil (`aria-pressed`) olarak söylenir. Seçim tarayıcıda
  saklanır; hiç seçilmediyse cihazın ayarı geçerlidir. Tema sayfa çizilmeden uygulanır (açılışta beyaz parlama yok),
  PWA'da telefonun durum çubuğu da temaya uyar. Kurallar: `lib/theme.ts`; Figma: 07 Koyu Mod sayfası, CampusFlow
  değişkenlerinin "Koyu" modu.
- **Uygulama kabuğu:** Masaüstünde sol kenar çubuğu (logo, kullanıcı, menü, çıkış). Telefonda üstte sabit çubuk:
  ana sayfalarda menü butonu + logo (menü soldan açılan panel, shadcn Sheet), alt sayfalarda (ör. `/cases/[id]`)
  geri butonu + başlık. Hangi sayfada hangi çubuğun çıkacağı `lib/shell.ts`, seçili menü öğesi `lib/navigation.ts`.
  Alt sekme çubuğu bilinçli olarak kullanılmıyor.
- **Tipografi:** Geist (kodda yüklü, Türkçe karakter destekli). Ölçek: 12 · 14 (gövde) · 16 · 20 · 24 · 30 px.
  Mobilde gövde metni en az 14 px, form alanları 16 px (iOS'ta otomatik zoom'u önler).
- **Boşluk:** Tailwind 4 px ızgarası (4, 8, 12, 16, 24, 32, 48). Figma'da auto-layout boşlukları bu değerlerden seçilir.
- **İkonlar:** [Lucide](https://lucide.dev) (kodda kurulu). Figma'da da Lucide ikon seti kullanılır.

### 4.1 Durum, öncelik ve SLA gösterimi

Değerler backend enum'larıdır ([DATABASE.md](DATABASE.md) bölüm 2); etiket ve renk eşlemesi kodda **tek dosyada**
(`frontend/src/lib/caseList.ts`, `CASE_STATUS_LABELS`) tutulur. Figma'daki Badge bileşeni bu tabloyla birebir çizilir.
Renkler öneridir; ekip değiştirebilir ama tabloyu ve kodu birlikte günceller.

Durum rozeti gri zeminde renkli nokta + durum adıdır; renkler görev rozetleriyle aynı **renk yolculuğunu** izler
(beklerken turuncu, çalışırken geçişli, çözülünce turkuaz). Yalnız "Yöneticiye iletildi" kırmızı zeminde ikonla
gösterilir. Kod: `CASE_STATUS_TONES` (`lib/caseList.ts`) ve `CaseStatusBadge` (`components/tasks/TaskBadges.tsx`);
Figma: 02 Components > CaseStatusBadge.

| `case_status` | Etiket (manager/staff) | Renk (token) |
|---|---|---|
| NEW | Yeni | gri (`muted-foreground`) |
| ANALYZING | İnceleniyor | mavi (`info`) |
| NEEDS_INFO | Bilgi bekleniyor | amber (`warning`) |
| CLASSIFIED | Sınıflandırıldı | mavi (`info`) |
| ASSIGNED | Atandı | koyu turuncu (`brand-accent-strong`) |
| ACCEPTED | Kabul edildi | turuncu (`brand-accent`) |
| IN_PROGRESS | Çalışılıyor | turuncudan turkuaza geçişli |
| RESOLVED | Çözüldü | turkuaz (`primary`) |
| VERIFICATION | Doğrulanıyor | turkuaz (`primary`) |
| CLOSED | Kapandı | koyu turkuaz (`primary-strong`) |
| REOPENED | Yeniden açıldı | amber (`warning`) |
| ESCALATED | Yöneticiye iletildi | kırmızı zemin + ikon (`destructive`) |
| REJECTED | Reddedildi | gri |
| MERGED | Birleştirildi | gri |

**Reporter için sadeleştirilmiş ilerleme** (kesinleşti, kod: `REPORTER_VIEWS` in `frontend/src/lib/status.ts`):
14 durum yerine 4 adımlı bir ilerleme çubuğu. Her durum tam olarak bir satıra düşer:

| Reporter adımı | `case_status` | Neden |
|---|---|---|
| **Alındı** | NEW, ANALYZING, CLASSIFIED, REOPENED | Yeniden açılan bildirim baştan ele alınır |
| **Yönlendirildi** | ASSIGNED, ACCEPTED, ESCALATED | ESCALATED = müdürün karar kuyruğu (ör. personel reddetti); reporter için iş hâlâ yönlendirme aşamasında, geri gitmiş gibi gösterilmez |
| **Çalışılıyor** | IN_PROGRESS | |
| **Çözüldü** | RESOLVED, VERIFICATION, CLOSED | |
| (bilgi kutusu) | NEEDS_INFO, REJECTED, MERGED | Adım yerine açıklama |

NEEDS_INFO kutusu **sorulan soruyu** `CaseRead.info_request` alanından gösterir ve altında yanıt kutusu olur
(`POST /cases/{id}/info`, `{body}`); yanıt gönderilince bildirim yeniden `ANALYZING` (Alındı) olur. REJECTED ve
MERGED sabit metinle anlatılır ("Aynı sorun zaten bildirilmiş, oraya eklendi").

| `priority` | Etiket | Renk | | SLA durumu | Etiket | Renk |
|---|---|---|---|---|---|---|
| LOW | Düşük | gri | | ON_TRACK | Zamanında | yeşil |
| MEDIUM | Orta | mavi | | AT_RISK (%75) | Riskte | amber |
| HIGH | Yüksek | turuncu | | BREACHED | Gecikti | kırmızı |
| CRITICAL | Kritik | kırmızı + ikon | | | | |

## 5. Rol Bazlı Ekran Kuralları

### 5.1 Reporter — `/report` (en kritik ekran)

- **Tek ekran, üç alan:** "Ne oldu?" (çok satırlı metin, örnek placeholder: *"B blok 2. kat erkek tuvalette sabun bitmiş"*),
  **Konum**, **Fotoğraf veya video (isteğe bağlı)**. Kategori/öncelik alanı **yok**.
- **Konum seçici:** Arama kutusu (lokasyon adı ve takma adlarıyla eşleşir: "b2 wc") + son kullanılan konumlar.
  Kampüs → Bina → Kat → Alan ağacı ikincil yol olarak sunulur. Metinde konum geçiyorsa AI önerir, kullanıcı onaylar.
  **Kodda olan:** arama kutusu + altında sonuç listesi (en çok 6 satır); arama ad, kod ve takma adlarda, büyük/küçük
  harf ve Türkçe karakter farkı gözetmeden yapılır (`searchLocations`, `lib/report.ts`). Konumlar bir kez yüklenir,
  arama tarayıcıda yapılır. Seçilen konum "Değiştir" ile temizlenir. Son kullanılanlar, ağaç ve AI önerisi henüz yok.
- **Fotoğraf / video:** Kamera veya galeri; fotoğraf jpg/png/webp en fazla 10 MB, video mp4/mov en fazla
  30 sn ve 50 MB (toplam 5 dosya). Yükleme sırasında önizleme ve ilerleme; video için süre aşımı mesajı
  (`VIDEO_TOO_LONG`) Türkçe gösterilir. Telefonda seçim kutusunun altında **Fotoğraf çek** düğmesi kamerayı doğrudan açar
  (`capture="environment"`); masaüstünde gizlidir. Kurallar galeriyle aynıdır (Figma: Button/Outline Fotoğraf çek).
- **Gönder butonu** ekranın altında, başparmak erişiminde, tam genişlik.
- **Taslak:** Açıklama ve seçilen konum yazıldıkça (yarım saniye bekleyerek) bu cihazda, giriş yapan kişiye özel
  saklanır. Form yeniden açılınca geri gelir ve başlığın altında "Taslağınız geri yüklendi." notu ile **Taslağı sil**
  düğmesi görünür. Fotoğraf ve videolar saklanamaz; taslakta dosya varsa not "Fotoğrafları yeniden eklemelisiniz."
  diye hatırlatır. Bildirim gönderilince ve çıkış yapılınca taslak silinir (`lib/reportDraft.ts`,
  `hooks/useReportDraft.ts`; Figma: DraftNotice, `/report - mobil/masaüstü - taslak geri yüklendi`).
- **Onay ekranı:** Bildirim numarası (`CASE-000124`), "Bildiriminiz alındı, inceleniyor" ve "Bildirimlerim" bağlantısı.
- Başarı ölçütü: yeni bir kullanıcı ilk denemesinde 30 sn içinde gönderebilmeli (ekip içi kullanılabilirlik testi, bölüm 10).

### 5.2 Reporter — `/my-cases`, `/cases/[id]`

- Liste kartı: kısa metin, konum, tarih, **4 adımlı ilerleme** (bölüm 4.1).
- **Bildirim zili (Sizden yanıt bekleniyor):** Telefonda üst çubukta tema düğmesinin solunda (her sayfada),
  masaüstünde Bildirimlerim'de "Bildirim yap"ın solunda. Bildirenin bir şey yapması gereken bildirim varsa zil açık
  turuncu (`bg-warning/15`, simge turuncu), yoksa açık gri. Tıklayınca telefon bildirimi gibi pencere açılır: ek bilgi
  istenenler ("Sizden ek bilgi istendi") önce, sonra kapandıktan sonraki 72 saat içinde puan verilmemişler ("Çözüldü ·
  değerlendirmenizi bekliyor"); uzunsa pencere kaydırılır. Bildirime tıklayınca detayı açılır ve pencere kapanır.
  Bekleyen yoksa "Şu an sizden yanıt bekleyen bildirim yok." Ekran okuyucuya "Bildirimler: N yanıt bekliyor" denir.
  Kendi bildirimlerinin ilk 100'ü taranır (`GET /cases/mine?page_size=100`), her rolde çalışır. Kural: `actionNeeded`
  (`lib/caseActions.ts`); Figma: WaitingBell, NotificationPanel, MobileAppBar > Actions.
- Listenin üstünde filtre: **Tümü / Açık / Çözülen**. "Çözülen" ilerlemedeki Çözüldü adımıdır; "Açık" henüz
  çözülmemiş olanlar (ek bilgi bekleyen dahil); reddedilen ve birleştirilen yalnız "Tümü"nde. Filtreye uyan bildirim
  yoksa "Açık bildiriminiz yok." ve "Tümünü göster". Hiç bildirimi olmayana filtre gösterilmez. Filtre `GET /cases`
  ile durum süzerek istenir (backend bildirenin bu listesini yalnız kendi bildirimleriyle sınırlar); bu yüzden
  yalnız bildiren rolünde çıkar. Kurallar: `lib/status.ts` (`myCasesPath`).
- Detay: zaman çizelgesi reporter'a sade dilde ("Temizlik birimine yönlendirildi", "Görevli çalışmaya başladı").
  Agent adları, güven skorları, iç notlar reporter'a **gösterilmez**.
  Zaman çizelgesi 5 ya da daha fazla adımsa kapalı gelir: son 3 adım görünür, üstte "N önceki adımı göster";
  açılınca "Önceki adımları gizle". Kural: `collapsedTimeline` (`lib/timeline.ts`).
- Ek bilgi istenen bildirimde (NEEDS_INFO) ilerleme çubuğu yerine soru + yanıt kutusu gösterilir.
- Aynı sorunu başkaları da bildirdiyse (bildirimlerin bu bildirime eklendiyse) durumun altında "Bu sorunu siz dahil
  N kişi bildirdi." yazar (`duplicate_count + 1`; `reportedByText`, Figma: DuplicateNote).
- Kapanıştan sonraki 72 saat içinde puan kartı: 1–5 yıldız + isteğe bağlı yorum (bir kez) ve aynı kartta
  "Sorun devam ediyor" (reopen; gerekçe zorunlu). Telefonda alttan açılan panel, masaüstünde ortada pencere.
  72 saat geçince kart gösterilmez; puan verildiyse yalnız verilen puan görünür. Kurallar: `lib/caseActions.ts`.
- **Yorumlar** (bildirim detayı, görev detayı ve müdürün bildirim detayı; tek bileşen `CaseComments`): yorum listesi
  (ad, rol, zaman, metin) ve altında "Yorum yaz" kutusu + "Gönder". Bildirim yapan yalnız herkese açık yorum yazar ve
  görür. Personel ve müdür "İç not (bildirim yapan görmez)" kutusunu işaretleyerek iç not yazabilir; iç not gri
  kutuda ve "İç not" etiketiyle gösterilir (yalnız renkle değil). Yönetici yorumları okur, yazma kutusu çıkmaz
  (backend `403`). Yorum en fazla 2000 karakter; boşken "Gönder" kapalıdır, gönderilince kutu boşalır, hata olursa
  yazılan durur. Yorum yoksa "Henüz yorum yok.". Ek bilgi yanıtı da yorum olarak listede görünür. Kurallar:
  `lib/comments.ts`.

### 5.3 Staff — `/staff/tasks`, `/staff/tasks/[id]`

- Liste sıralaması: SLA'ya kalan süre (en acil üstte). Kartta **konum** en büyük metin, sonra iş tanımı ve kalan süre.
- Ana eylem butonu duruma göre tek ve büyük: **Kabul et** → **Başlat** → **Tamamla**. Dokunma alanı en az 44×44 px.
  Detayda eylem butonları bilgilerin hemen altında, yorumların **üstünde** durur; görevli kaydırmadan görür.
- Tamamla: not (isteğe bağlı) + kanıt fotoğrafı. Reddetme (decline) ikincil buton ve gerekçe ister.
- Kartta ve detayda üç rozet: durum (renk yolculuğu: beklerken turuncu, çalışırken geçişli, bitince turkuaz nokta),
  öncelik ve SLA'ya kalan süre ("42 dk kaldı" / "25 dk gecikti"; yeşil `--success`, sarı `--warning`, kırmızı
  `--destructive`, her zaman ikon + metinle). Biten görevde süre rozeti ve eylem yoktur; sonuç kartı gösterilir.
  Kurallar: `lib/tasks.ts`.
- Kanıt fotoğrafı (isteğe bağlı, birden fazla): telefonun dosya seçicisi kamerayla çekmeyi ya da galeriden seçmeyi
  sunar. JPG/PNG/WEBP, her biri en fazla 10 MB, en çok 5 kanıt fotoğrafı (bildirenin dosyalarından ayrı sınır, asıl denetim
  backend'de); gönderilmeden önce denetlenir. Önce fotoğraflar sırayla yüklenir (`POST /cases/{id}/attachments`,
  backend personelin dosyasını `EVIDENCE` olarak kaydeder), sonra görev tamamlanır; yükleme başarısızsa görev
  tamamlanmaz. Tamamlanan görevin sonuç kartında kanıt fotoğrafları küçük görsel olarak gösterilir.
- Eksik kanıt: Resolution Agent işi yetersiz bulursa görev `IN_PROGRESS`'e geri döner. Detayda sarı kutu
  ("Eksik kanıt: görev sana geri döndü") nedeni gösterir; metin bildirimin olay geçmişindeki son
  `EVIDENCE_REQUESTED` olayının `metadata.message` alanıdır (ekran uydurmaz). Tamamla panelinde fotoğraf eklemenin
  işi ek doğrulama beklemeden kapattığı yazar.

### 5.4 Manager

- **İnceleme kuyruğu:** Her satırda AI önerisi (tip, öncelik, departman), güven skoru ve **neden buraya düştü**
  (düşük güven / olası tekrar / güvenlik). Satırdan çıkmadan: onayla · düzelt (override) · birleştir · reddet.
- **AI karar gerekçe paneli** (projenin en özgün bileşeni): her agent için karar, güven (yüzde + çubuk), gerekçe maddeleri
  (ör. "‘kıvılcım’ kelimesi → güvenlik +30"), kullanılan model (`tfidf-logreg@…`, `rules@1.0`). Düzeltme yapılırsa
  gerekçe zorunludur; bu kayıt modelin yeniden eğitimi için veri olur.
- **Dashboard:** üstte 4–6 KPI kartı (açık kayıt, SLA uyumu, ortalama çözüm süresi, otomasyon oranı), altında trend
  ve dağılım grafikleri. Her grafik başlığı sorunun cevabını söyler ("Bu hafta en çok sorun: B Blok").
  **Kodda olan (`/manager/dashboard`, menüde "Genel Bakış"):** dönem düğmesi (Son 7 gün / Son 30 gün), 6 KPI kartı
  (açık bildirim, SLA uyumu, ortalama çözüm süresi, otomasyon oranı, bugün açılan, müdür incelemesi oranı),
  açılan/kapanan çubuk grafiği, kategori çubukları ve yapay zekâ yönetim özeti. Değişim oku yöne göre değil iyi/kötü
  olmasına göre renklenir (açık bildirim artarsa kırmızı ▲); önceki dönemde veri yoksa "önceki dönemde veri yok".
  Değişim %100'den büyükse yüzde yerine fark kartın kendi biriminde yazılır ("▲ %2000" yerine "▲ 40", oranlarda
  "▲ 12 puan", sürede "▲ 2 sa 10 dk"); önceki dönem çok küçükken yüzde anlamsız büyür. Grafik kütüphanesi
  kullanılmaz: çubuklar düz HTML/CSS, açılan turuncu ve kapanan turkuaz (renk yolculuğu); durum renkleri grafikte
  kullanılmaz. Sayılar ekran okuyucuya metin olarak da verilir. Telefonda kartlar ikişerli, grafikler alt alta.
  **Kartlar tıklanır** (sağ üstte ok): Açık Bildirim → Tüm Bildirimler "Açık" filtresiyle (`?group=open`), SLA Uyumu →
  "Geciken" filtresiyle (`?group=late`), Ortalama Çözüm Süresi → Raporlar, Otomasyon Oranı → Yapay Zekâ Performansı,
  Bugün Açılan → Tüm Bildirimler, Müdür İncelemesi Oranı → İnceleme Kuyruğu. Kart yalnız rolün menüsündeki ekrana
  bağlanır: yöneticide İnceleme Kuyruğu olmadığı için o kart düz kalır. Birim detayındaki göstergeler bağlantı değildir
  (liste birime göre süzülemez). Kurallar: `lib/analytics.ts` (`KPI_LINKS`).
- **Raporlar (`/manager/analytics`):** dönem düğmesi ve sekiz kart: bina yoğunluğu, zamanında çözülen (SLA),
  çözüm süreleri, bekleyen bildirimler, birim performansı, tekrarlayan sorunlar, süreç adımları, süreç haritası. Her kartın başlığı
  sonucu söyler ("En yoğun bina: B Blok (21 bildirim)", "En yavaş adım: Atamadan kabule"); veri yoksa düz ad ve tek
  satır açıklama gösterilir. İstatistik terimi yazılmaz: medyan "Tipik süre", p90 "10 işten 9'u" diye geçer ve
  tablonun altında açıklanır. Çubuklar turkuaz; yalnız en eski bekleyenler (24+ sa) kırmızı, en yavaş adım turuncu ve
  "En yavaş" etiketli. Tablolar (`StatTable`) masaüstünde klasik tablo, telefonda her satır ikili ızgarada küçük bir
  kart olur (sütun başlığı değerin üstüne yazılır). Bina yoğunluğunda ve tekrarlayan sorunlarda önce ilk 5 satır görünür,
  kalanı "N binanın / N sorunun hepsini göster" düğmesiyle açılır; konum okunur adıyla (`location.name`) yazılır, kod yolu
  (`path`) gösterilmez. Tekrarlayan sorunda backend önleyici bakım önerisi verdiyse (`routine_suggestion`) önerinin
  altında turkuaz bir satır çıkar ("Genellikle 2 günde bir tekrarlıyor; 2 günde bir rutin kontrol planlanabilir.").
  **Süreç haritası** (süreç madenciliği, `GET /analytics/process-map`) en altta tam genişlikte durur; başlık en sık
  yolu söyler ("En sık yol: bildirimlerin %57'si (tipik 48 dk)"). Solda **En sık yollar**: adımlar okla yazılır
  ("Bildirim açıldı → Görev oluşturuldu → …"), çubuk bildirimlerin payı, altında bildirim sayısı ve tipik toplam süre;
  en uzun süren yol turuncu ve "En uzun" etiketli. Sağda **Adımlar arası bekleme**: en uzun bekleme üstte, turuncu ve
  "Darboğaz" etiketli; altında kaç kez görüldüğü. 3'ten az görülen geçiş listeye girmez (tek tük bir uzun bekleme
  darboğaz gibi görünmesin). İki liste de önce 5 satır gösterir; telefonda alt alta. Kurallar: `lib/reports.ts`.
- **Yazdırma (Raporlar, Birim Performansı, birim detayı):** dönem düğmesinin yanında **Yazdır** düğmesi tarayıcının
  yazdırma penceresini açar ("PDF olarak kaydet" de oradan). Kağıtta menü, üst çubuk, dönem düğmesi, Yazdır ve
  "hepsini göster" düğmeleri gizlenir; başlığın altına "Son 7 gün · BakırçayFlow · Yazdırıldı: <tarih saat>" yazılır.
  Kartlar sayfa arasında bölünmez, çubuk renkleri basılır (`print-color-adjust: exact`), koyu moddayken de açık temayla
  basılır (`usePrintLightTheme`). Figma: Button/Outline Yazdır, `/manager/analytics - yazdırma (A4)`.
- **Birim Performansı (`/manager/departments`, menüde Raporlar'ın altında):** dönem düğmesi, tikli birim filtresi
  (`CheckboxFilter`: açılır pencerede birimler işaretlenir, seçim hemen uygulanır, "Seçimi temizle"; boş seçim
  "hepsi"), her birim bir kare kart: bildirim, zamanında (SLA), tipik çözüm, açık görev ve "N personel · kişi başı
  N açık görev". En çok bildirim alan birim önce. Kartın tamamı birimin detayına gider; 30 gün seçiliyse detay da 30
  günle açılır (`?period=30d`). **Detay (`/manager/departments/[id]`):** birim özeti (kartla aynı sayılar), Genel
  Bakış göstergeleri, açılan/kapanan grafiği, sorun türleri ve tekrarlayan sorunlar; hepsi yalnız o birim için
  (`department_id`). Listede olmayan birim "Birim bulunamadı" der. Kurallar: `lib/departments.ts`.
- **Yapay zekâ performansı (`/manager/agents`):** dört oran kutusu (otomasyon, müdür incelemesi, doğru tür tahmini,
  doğru tekrar tespiti; her birinin altında bir cümlelik açıklama) ve adım tablosu (karar sayısı, ortalama güven,
  düzeltilme oranı). "Agent" yerine "adım", "override" yerine "düzeltilme" denir; adım adları backend'den gelir.
  Kurallar: `lib/agentMetrics.ts`.
- **Tüm Bildirimler (`/manager/cases`):** müdür kurumdaki bütün birimlerin bildirimlerini görür (backend böyle
  döner), ekran metni de "Kurumdaki bütün bildirimler" der. Arama kutusu (numara, başlık, konum; yazmayı bıraktıktan 300 ms sonra arar),
  öncelik seçimi ve durum grubu düğmeleri. 14 durum beş gruba toplanır: Tümü, Açık, Kapanan, Reddedilen ve
  birleştirilen, Geciken (hedef süresi aşılan açık bildirimler). Her satırda numara, başlık (altında tür ve okunur
  konum adı), birim, durum, öncelik, kalan süre ve açılış zamanı; satır detay ekranına gider. Yönetici aynı listeyi
  görür. Personel aynı listeyi **Birim Bildirimleri** (`/staff/cases`) adıyla görür; backend personele yalnız kendi
  biriminin ve kendisine atanan bildirimleri döndürür. Detay ekranı role göre bölüm gösterir (`caseDetailSections`,
  `lib/managerCase.ts`): yapay zekâ kararları yalnız müdür ve yöneticiye, karar kutusu (onayla, düzelt, reddet)
  yalnız müdüre; personel bilgileri, zaman çizelgesini, fotoğrafları ve yorumları görür. Masaüstünde tablo,
  telefonda her bildirim ayrı kart (tek DOM, iki yerleşim). Liste 20'şer yüklenir ("Daha fazla göster"). Filtreyle
  sonuç çıkmazsa "Filtreleri temizle" düğmesi, hiç bildirim yoksa düz açıklama gösterilir. Kurallar: `lib/caseList.ts`.
- **Bildirim detayı (`/manager/cases/[id]`):** müdürün ayrıntılı ekranı; bildirenin sade ekranı (`/cases/[id]`)
  değişmedi. Üstte numara, başlık ve üç rozet (durum, öncelik, kalan süre). **Bildirim bilgileri** kartı: açıklama,
  konum, tür · kategori, birim, açılış; varsa hedef süre, çözüm, kapanış, bildirenin puanı, aynı sorunu bildirenler,
  yeniden açılma (olmayan şey gösterilmez). **Yapay zekâ kararları:** İnceleme Kuyruğu'ndaki gerekçe panelinin aynısı,
  burada hep açık; kendiliğinden atanan bildirimde de görünür. Gerekçeler sade yazılır; ağırlıklar ("Konumun önemi ·
  ağırlık +8") ve model adı her adımın altındaki kapalı **"Ayrıntılar"** bölümündedir. Sıfır ağırlık yazılmaz. **Zaman çizelgesi:** müdür bütün
  olayları görür; bildirenin ekranındaki gibi 5 ya da daha fazla adımda kapalı gelir (son 3 adım + "N önceki adımı
  göster", `CollapsibleTimeline`); personelin Birim Bildirimleri detayında da aynısı; her satırda ne olduğu, kimin yaptığı ("Yapay zekâ · Sınıflandırma", "Sistem", "Bildiren", "Personel",
  "Müdür") ve zamanı. Olayda kişi adı gelmediği için kişi türü olayın türünden anlaşılır. **Fotoğraflar:** bildirenin
  fotoğrafları ve personelin kanıtları; yoksa bölüm çıkmaz, video küçük resim olarak gösterilmez. Bildirim İnceleme
  Kuyruğu'ndaysa üstte **"Bu bildirim kararınızı bekliyor"** kutusu çıkar: neden burada, varsa benzer bildirim ve
  kuyruktaki kartla aynı düğmeler (onayla ve ata · birleştir · düzelt · reddet · kapat; kurallar `lib/review.ts`).
  Karardan sonra kutu kaybolur, onay notu ("CASE-… atandı.") ekranda kalır. Kuyruk kaydı okunamazsa yalnız kuyruğa
  bağlantı gösterilir. Kuyrukta olmayan bildirimde düğme yoktur. Geniş ekranda iki sütun (solda kararlar ve çizelge, sağda bilgiler ve fotoğraflar), dar ekranda önce
  bilgiler. Kurallar: `lib/managerCase.ts`.

### 5.5 Admin

- Tek kalıp: arama + filtre + tablo + sağdan açılan düzenleme paneli (Sheet). Silme yok; **Pasifleştir** (soft delete).
- **Konumlar** (`/admin/locations`): ağaç görünümü (Kampüs → Bina → Kat → Alan). Ekran açılınca en üst düzey açıktır;
  bir konumun altı okuna basınca açılır. Arama (ad, kod, diğer adlar) ya da durum filtresi varken sonuçlar düz
  listedir ve her sonucun altında yeri yazar ("Merkez Kampüs › B Blok"). Tür ve kod yalnız eklerken seçilir.
  Üst konum değişirse konum altındakilerle birlikte taşınır. Ekranda "lokasyon" yerine "konum" yazılır.
- **Birimler** (`/admin/departments`): birim adı ya da kod araması, durum filtresi; tabloda her birimin aktif
  kullanıcı sayısı görünür. Kod yalnız eklerken yazılır (büyük harf, rakam, alt çizgi; yazarken kendiliğinden
  bu biçime çevrilir) ve sonradan değiştirilemez. Ortak parçalar `components/admin/AdminParts.tsx` ve
  `AdminTable.tsx` içindedir; yeni yönetim ekranı bunları kullanır.
- **Bildirim Türleri** (`/admin/case-types`): tür adı, kod ya da anahtar kelime araması; kategori ve durum filtresi.
  Liste ada göre alfabetik sıralanır (API koda göre sıralar).
  Tabloda adın altında kod, güvenlikle ilgili türlerde "Güvenlikle ilgili" notu; görevi alan birim boşsa "Birim yok".
  Panelde: ad, kod (yalnız eklerken; sonradan kilitli), kategori, görevi alan birim ve bilgilendirilen birim
  (ikisi de boş bırakılabilir), başlangıç önceliği, ciddiyet (0–100), güvenlikle ilgili kutusu, anahtar kelimeler
  (virgülle ayrılır, küçük harfe çevrilir). Eklerken kısa bir not çıkar: model yeni türü yeniden eğitilene kadar
  anahtar kelimelerle bulur ve türe bir yapay zekâ politikası kendiliğinden açılır.
- **Süre Hedefleri** (`/admin/sla-rules`): bir bildirimin kabul ve çözüm süresi. Türü boş kural "Varsayılan
  (tüm türler)" adıyla en üstte, önceliğe göre durur; türe özel kurallar tür adına göre dizilir. Süreler dakika
  yerine okunur yazılır ("30 dk", "4 saat", "1 gün", "1 saat 30 dk"); uyarı eşiği "%75". Arama tür adında; öncelik ve
  durum filtresi. Panelde süre **sayı + birim** (dakika, saat, gün) olarak girilir. Tür ve öncelik yalnız eklerken
  seçilir. Aynı tür ve öncelik için ikinci kural gönderilmeden açıklanır (pasif kural varsa "onu aktifleştirin");
  çözüm hedefi kabul hedefinden kısa olamaz; uyarı eşiği 1–99.
- **Yapay Zekâ Politikaları** (`/admin/agent-policies`): tür başına bir satır; ekleme ve pasifleştirme yok (politika,
  tür eklenince kendiliğinden açılır), bu yüzden "ekle" düğmesi ve durum filtresi bulunmaz. Seviyeler düz Türkçe
  yazılır: `L1_AUTONOMOUS` "Kendi uygular", `L2_NOTIFY` "Uygular, müdüre haber verir", `L3_ESCALATE` "Müdür karar
  verir". Güven eşiği yüzde olarak gösterilir ve girilir ("%70"; API'de 0–1). Panelde seviye, açıklamalı üç
  seçenekten seçilir; arama tür adı ya da kodda, filtre karar yetkisinde. Ayrı bir "Müdüre haber" kutusu yoktur:
  müdüre haber verilip verilmeyeceğini seviye belirler (L2 haber verir, L3 zaten müdüre gider).
- **İşlem Kayıtları** (`/admin/audit-logs`): yalnız okunur; en yeni üstte, 50'şer kayıt ("1–50 / 312 kayıt",
  Önceki / Sonraki). Sütunlar: zaman, kim, işlem ("Birim güncellendi" + kaydın adı), değişiklik. Değişiklik
  ekranların kendi sözcükleriyle yazılır ("Çözüm hedefi: 2 saat → 3 saat", "Durum: Aktif → Pasif"); kod ve numaralar
  ada çevrilir (`lib/auditLogs.ts`). Yeni kayıtta alanlar "Alanları göster" ile açılır. Kayıt türü filtresi sunucuda
  uygulanır; uyan kayıt yoksa "Farklı bir kayıt türü seçin…" önerilir (bu ekranda arama kutusu yok). Kaydın adı güncel listelerden bulunur; bulunamazsa kayıttaki ad ya da "#12" yazılır.
  Diğer sekmelerdeki düzenleme panellerinde **"Geçmişi gör"** bağlantısı o kaydın geçmişini açar
  (`?entity_type=…&entity_id=…`); üstte "… kaydının geçmişi" şeridi ve "Tüm kayıtları göster" bağlantısı çıkar.
- **Sekmeler ve panel:** telefonda sekme şeridi yana kayar, seçili sekme açılışta görünür yere gelir. Ekle/düzenle
  paneli telefonda tam genişlik, masaüstünde 440 px (`SHEET_CLASS`, `components/admin/AdminParts.tsx`).
- **Kullanıcılar** (`/admin/users`): ad ya da e-posta araması, rol ve durum filtresi. Masaüstünde tablo; telefonda
  aynı tablo kart olarak görünür (ad ve durum üstte, diğer değerler başlıklarıyla alt alta), yana kaydırma olmaz.
  Filtrelere uyan kullanıcı yoksa "Filtreleri temizle" düğmesi çıkar. Bölümler arası geçiş üstteki sekmelerle
  (`ADMIN_SECTIONS`, `lib/navigation.ts`); menüdeki "Yönetim" ilk sekmeye açılır.

## 6. Metin ve Dil

- Arayüz metinleri **tam Türkçe** ve Türkçe karakterli ("Gönder", "Bildirimlerim"). Butonlar, açıklamalar ve kart
  başlıkları cümle düzeninde yazılır ("Tekrar dene"). **İstisna:** menü adları, bu adları taşıyan sayfa başlıkları ve
  gösterge kutularının küçük başlıkları her kelimenin baş harfi büyük yazılır ("Bildirim Yap", "Genel Bakış",
  "Açık Bildirim").
- Menü ve başlıklarda yabancı terim kullanılmaz; memurların bildiği adlar yazılır: "Genel Bakış" (dashboard),
  "Raporlar" (analytics), "Yapay Zekâ Performansı" (agent metrikleri), "Tüm Bildirimler" (case listesi).
  Adresler (route) İngilizce kalır (`/manager/dashboard`); tek kaynak `lib/navigation.ts`.
- Girişten sonra herkes kendi ilk ekranına gider: bildirim yapan `/my-cases`, personel `/staff/tasks`, müdür
  `/manager/dashboard`, yönetici (ADMIN) `/admin` (`homePathFor`, `lib/navigation.ts`).
- Ekran metinlerinde "AI" yazılmaz, "yapay zekâ" yazılır ("Yapay zekâ önerisi", "Yapay zekâ yönetim özeti"). Tek
  istisna ürünün eski adıdır ("CampusFlow AI"); ekranda görünen ad artık "BakırçayFlow".
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

**Bağlantı yok:** İnternet kopunca içeriğin üstünde uyarı renginde bir şerit çıkar: "İnternet bağlantınız yok. Bağlanınca sayfa
yenilenir." Telefonda üst çubuğun hemen altında, masaüstünde içerik sütununun en üstünde yapışık durur; giriş ekranında
da en üsttedir. Bağlantı yalnız tarayıcının bilgisinden anlaşılmaz (Windows'ta Docker/WSL gibi sanal ağ kartları açıkken
Wi-Fi kapansa da tarayıcı "bağlıyım" der): sunucuya giden bir istek ağ hatasıyla düşerse de şerit çıkar ve sunucu 10 sn'de
bir yoklanır; herhangi bir cevap gelince şerit kalkar (`lib/api/reachability.ts`). Bağlantı gelince şerit kalkar ve
sorgular kendiliğinden yeniden okunur (`OfflineBanner`, `hooks/useOnline.ts`;
Figma: OfflineBanner, `/report - … - bağlantı yok`, `/login - mobil - bağlantı yok`).

**Kendini yenileme:** İş listeleri ve detaylar dakikada bir yeniden okunur; böylece başkasının yaptığı değişiklik sayfa
yenilenmeden görünür: Görevlerim ve görev detayı, İnceleme Kuyruğu, Bildirimlerim, Tüm/Birim Bildirimleri, bildirim
detayı, zaman çizelgesi, yorumlar ve Pano KPI'ları. Sekme arka plandayken ya da bağlantı yokken sayaç durur; sekmeye
dönünce sorgular yine yenilenir. Raporlar ekranı elle bakıldığı için yenilenmez (`LIVE_REFRESH_MS`, `lib/queryClient.ts`).

## 8. Erişilebilirlik (WCAG 2.2 AA)

- Metin kontrastı en az 4.5:1 (büyük metin 3:1). Figma'da kontrast eklentisiyle kontrol edilir. Lighthouse ölçümünden
  (Ekim 2026) sonra `muted-foreground` (`#6C6C6C`), `destructive` ve `warning` biraz koyulaştırıldı ve gri zemindeki
  turkuaz yazı için `primary-text` eklendi; token çiftleri `src/app/colorContrast.test.ts` ile açık ve koyu temada
  denetlenir (gri zeminde soluk yazı, rozetler kendi %10 tonunda, turkuaz üstünde buton yazısı). Figma'da kütüphanenin
  `muted-foreground` ve `destructive` değişkenleri yerine yerel `muted-foreground-aa` ve `destructive-aa` kullanılır.
- Liste öğesine (`li`) rol verilmez; adlı grup gerekiyorsa öğenin içindeki kutuya verilir (Genel Bakış kartları).
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

- Endpoint henüz `501` dönüyorsa frontend **MSW** sahte API'siyle çalışır (`frontend/src/mocks/`, ayrıntı:
  [frontend/README.md](../frontend/README.md)). Backend endpoint'i uygulayınca ilgili sahte handler silinir.
- API tipleri **elle yazılmaz**: backend çalışırken `cd frontend && npm run gen:api`. CI'daki `api-contract` job'u
  tiplerin güncel olmadığı PR'ı kırmızıya çevirir.
- Ekranda gerekip API'de olmayan bir alan fark edilirse backend'e issue/PR yorumu olarak yazılır; frontend tahmin edip uydurmaz.
- Backend kendi başına test edilir: pytest + `http://localhost:8000/docs` (Swagger "Try it out").

## 10. Figma → Kod

- **Dev Mode:** Geliştirici ölçü, renk değişkeni ve boşlukları Figma Dev Mode'dan okur.
- **AI ile kodlama:** Frontend ekibi Figma'nın resmi **MCP sunucusunu** Claude Code'a kendisi bağlar; repodaki
  **`campusflow-screen`** skill'i seçili frame'i okuyup bu rehbere, shadcn/ui'a, sahte API'ye ve test kurallarına
  göre ekranı yaptırır (kullanım: [frontend/README.md](../frontend/README.md)). MCP bağlanamazsa yedek yol:
  frame'in ekran görüntüsü.
  AI'ın yazdığı kod da KOD_KURALLARI'na tabidir ve test edilir.
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
