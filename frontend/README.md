# frontend/ — Next.js (App Router)

Kurallar: [KOD_KURALLARI.md](../KOD_KURALLARI.md) · Tasarım: [docs/UI_GUIDE.md](../docs/UI_GUIDE.md) ·
Stil: [docs/CONVENTIONS.md](../docs/CONVENTIONS.md). Next.js 16 kullanılıyor; API'ler eski sürümlerden farklı
olabilir — `node_modules/next/dist/docs/` (bkz. `AGENTS.md`).

## Çalıştırma

Backend + veritabanı Docker'da, frontend doğrudan bilgisayarda çalışır:

```bash
docker compose up -d          # repo kökünde (backend :8000, db :5433)
cd frontend
npm ci
npm run dev                   # http://localhost:3000
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (hot reload) |
| `npm test` | Vitest testleri |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript (CI'da da çalışır) |
| `npm run gen:api` | Backend çalışırken OpenAPI'den `src/lib/api/types.ts` üretir (**elle düzenlenmez**) |

## Klasörler

| Klasör | İçerik |
|---|---|
| `src/app/` | Sayfalar. `(app)/` menülü alan (giriş yapan kullanıcının rolüne göre), `(auth)/login` |
| `src/components/ui/` | shadcn/ui bileşenleri (`npx shadcn@latest add <ad>` ile eklenir) |
| `src/components/layout/` | `AppShell` (menü), `CurrentUserShell` (rolü `/auth/me`'den alır) |
| `src/hooks/` | Veri hook'ları (TanStack Query): `useHealth`, `useCurrentUser` |
| `src/lib/` | API istemcisi, üretilmiş tipler, saf yardımcılar + testleri (`navigation.ts`, `health.ts`, `queryClient.ts`) |
| `src/mocks/` | **Sahte API (MSW)**: backend'de henüz hazır olmayan endpoint'ler |

## Claude ile ekran yapmak (önerilen yol)

Repoda **`campusflow-screen`** adlı bir Claude skill'i var (`.claude/skills/campusflow-screen/`). Repoyu Claude
Code'da açan herkese otomatik yüklenir, kurulum gerekmez.

**1. Figma'yı Claude Code'a bağla (bir kez, kendin yap).** Figma'nın resmi **MCP sunucusunu** Claude Code'a
bağla; adımlar Figma'nın kendi yardım sayfalarında ("Figma MCP server"). Bu kurulumu yapmak işin bir parçası:
MCP'nin ne olduğunu, bir aracı Claude'a nasıl bağladığını öğrenmiş olacaksın. Takılırsan Claude'a hatayı
yapıştırıp sor. Bağlandığını anlamak için Claude'a *"Figma MCP araçların görünüyor mu?"* diye sorabilirsin.

**2. Ekranı yaptır.** Figma'da frame'i seç ve Claude'a yaz:

```
campusflow-screen skill'ini kullanarak Figma'da seçili ekranı /admin/departments sayfası olarak yap.
Bu ekranı ADMIN rolü görecek, masaüstü öncelikli.
```

(MCP henüz bağlı değilse skill önce bağlamanı ister. Mecbur kalırsan frame'in ekran görüntüsünü de verebilirsin.)

Claude sırasıyla: branch açar → UI_GUIDE'ı okur → Figma tasarımını shadcn bileşenlerine ve renk token'larına çevirir →
API'de gerçekten olan veriyi bulur (yoksa uydurmaz, Bahadır'a sorulacak şeyi yazar) → **önce kırmızı test** →
ekran → lint/test → dolu PR linki. Her adımı Türkçe açıklar; anlamadığın yerde "bunu açıkla" demen yeterli.

## Sahte API (MSW) — backend'i beklemeden ekran yapmak

Backend her fazın başında endpoint **şemalarını** yayınlar; iş mantığı gelene kadar bu endpoint'ler
`501 NOT_IMPLEMENTED` döner. Frontend bu arada **MSW** ile sahte cevap alır:

- `src/mocks/handlers.ts` — hangi endpoint'in sahte olduğu. Burada **olmayan** her istek gerçek backend'e gider.
- `src/mocks/caseHandlers.ts` + `caseFixtures.ts` — FAZ 3 bildirimleri (`/cases`, `/cases/mine`, `/cases/{id}`,
  `/cases/{id}/events`, `/locations`). Farklı durumlarda 4 örnek bildirim var; formdan gönderilen yeni bildirim
  `ANALYZING` durumunda listeye eklenir (sayfa yenilenince silinir). Açıklama 10 karakterden kısaysa `422` döner.
- `src/mocks/interactionHandlers.ts` — yorum (`/cases/{id}/comments`), puan (`/feedback`) ve yeniden açma (`/reopen`).
  Sahte API her isteği REPORTER sayar; 72 saat penceresini ve rol kurallarını yalnız gerçek backend denetler.
- `src/mocks/attachmentHandlers.ts` — fotoğraf/video yükleme (`POST /cases/{id}/attachments`, alan adı `file`), listeleme
  ve indirme. JPG/PNG/WEBP ve MP4/MOV dışı `415`; fotoğraf 5 MB, video 50 MB üstü `413` (30 sn sınırını
  yalnız gerçek backend denetler). Fotoğraf Bearer token ister: `<img src>` değil,
  `fetch` + `URL.createObjectURL` ile gösterilir.
- `src/mocks/fixtures.ts` — sahte veriler. Tipleri OpenAPI'den gelir; backend şeması değişirse burası
  **derlenmez**, uyumsuzluk hemen görülür.
- Sahte cevaplar service worker olmadan, doğrudan API istemcisinin içinde üretilir (`src/mocks/transport.ts`);
  sekme uzun süre boşta kalsa da kopmaz, her tarayıcıda çalışır.
- Aynı handler'lar Vitest testlerinde de kullanılır (`vitest.setup.ts`).

Ayarlar `frontend/.env.development` içinde; kendine özel değişiklik için `frontend/.env.local` oluştur (repoya girmez):

| Değişken | Değerler | Etki |
|---|---|---|
| `NEXT_PUBLIC_API_MOCKING` | `enabled` / `disabled` | Sahte API açık/kapalı |
| `NEXT_PUBLIC_MOCK_ROLE` | `REPORTER` `STAFF` `MANAGER` `ADMIN` | Sahte `/auth/me` hangi rolle dönsün → menü o role göre çizilir |

Sahte girişte tüm kullanıcıların parolası `demo1234`; e-postalar `src/mocks/fixtures.ts` içinde.
`.env` dosyası değiştikten sonra `npm run dev`'i durdurup yeniden başlat.

**Durum (FAZ 3):** backend'deki bütün endpoint'ler artık gerçek; sahte API **çevrimdışı çalışma modu** olarak
kalıyor (backend/Docker açmadan ekran geliştirmek ve testler için). Sahte cevapların şekli gerçek API ile aynı
tutulur; backend şeması değişince `npm run gen:api` + fixture düzeltmesi yeterli.

### Gerçek backend ile çalışmak (giriş dahil)

1. Repo kökünde: `docker compose up -d` ve bir kez `docker compose exec backend python -m seeds.run --demo`.
2. `frontend/.env.local` dosyası oluştur ve içine `NEXT_PUBLIC_API_MOCKING=disabled` yaz; `npm run dev`'i yeniden başlat.
3. http://localhost:3000 → giriş ekranı. Demo hesaplar ve parola: [backend/seeds/README.md](../backend/seeds/README.md)
   (örnek: `ogrenci@kampus.example.com`, `mudur.destek@kampus.example.com`). Menü hesabın rolüne göre gelir.
4. Sahte API'ye dönmek için `.env.local`'deki satırı sil (ya da `enabled` yap) ve dev'i yeniden başlat.

### Oturum nasıl çalışıyor (`src/lib/api/`)

- `session.ts` — `login()`, `logout()`. Access token **yalnız bellekte** (`tokenStore.ts`); `localStorage`'a
  yazılmaz (XSS ile çalınamasın). Sayfa yenilenince bellek boşalır.
- `client.ts` — her isteğe `Authorization: Bearer` ekler. `401` gelirse backend'in HttpOnly refresh çereziyle
  **bir kez** `POST /auth/refresh` yapar ve isteği tekrarlar; o da `401` ise oturum biter. Aynı anda gelen
  401'ler **tek** yenilemeyi bekler (aynı çerez iki kez kullanılırsa backend bunu çalınma sayabilir).
  `/auth/login`, `/auth/refresh`, `/auth/logout` için yenileme denenmez; `/auth/me` için denenir (sayfa
  yenilenince ilk istek odur).
- `CurrentUserShell` — oturum yoksa `/login`'e yönlendirir. `LogoutButton` — çıkışta sorgu önbelleğini de siler.
- Ekranlarda veri için `apiGet` / `apiPost` kullan; token'la hiç uğraşma.

## Yeni bir ekran eklemek (örnek: `/admin/departments`)

1. `develop`'u çek, branch aç: `git checkout -b feature/admin-departments-page`
2. Figma'daki tasarımı ve [UI_GUIDE](../docs/UI_GUIDE.md) kontrol listesini aç (yükleniyor · boş · hata durumları dahil).
3. Veri hook'u yaz: `src/hooks/useDepartments.ts` — `apiGet<Page<DepartmentRead>>("/admin/departments")`.
   Tipler `components["schemas"]["..."]` ile `src/lib/api/types.ts`'ten alınır.
4. Sayfa: `src/app/(app)/admin/departments/page.tsx`; bileşenler shadcn/ui'dan.
   İş kuralı (hesaplama, eşleme) bileşene değil `src/lib/` altına saf fonksiyon olarak yazılır.
5. Test: önce kırmızı, sonra yeşil (`src/.../*.test.tsx`). Sahte veri zaten MSW'de; `server.use(...)` ile
   hata durumunu da test et (örnek: `src/hooks/useCurrentUser.test.tsx`).
6. `npm run lint && npm run typecheck && npm test` → push → PR (`develop`), ekran görüntüsü ekle (masaüstü + mobil).

## Sık sorunlar

| Sorun | Çözüm |
|---|---|
| Sürekli giriş ekranına dönüyor | Sahte API kapalıyken backend çalışmıyor ya da seed yapılmamış: `docker compose up -d` + seed |
| "Backend'e ulaşılamıyor" | Repo kökünde `docker compose up -d` çalıştır |
| Tip hatası: alan bulunamadı | Backend şeması değişmiş: `npm run gen:api`, sonra `fixtures.ts`'i düzelt |
