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

**Backend bir endpoint'i gerçekten uyguladığında** (PR açıklamasında yazar): ilgili handler'ı
`handlers.ts`'ten sil → ekran artık gerçek backend'le çalışır. Başka değişiklik gerekmez.

**İstisna — giriş (`/auth/*`):** backend hazır, ama sahte handler'lar login ekranı gerçek API'ye bağlanana
kadar kalır. Login ekranını bağlarken (E2-1 ekranı):
- `POST /auth/login` → dönen `access_token`'ı **yalnız bellekte** tut (React state/context); `localStorage`'a
  **yazma** (XSS ile çalınabilir).
- Her istekte `Authorization: Bearer <token>` gönder; `401` gelirse bir kez `POST /auth/refresh` dene,
  o da `401` ise login'e yönlendir.
- Refresh token'a hiç dokunma: tarayıcı onu httpOnly cookie olarak kendisi tutar. Bunun için `/auth/*`
  isteklerinde `credentials: "include"` gerekir.
- Bitince `handlers.ts`'teki dört `/auth/*` handler'ını sil.

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
| "Kullanıcı bilgisi alınamadı: Bu özellik henüz hazır değil" | Sahte API kapalı ve backend bu endpoint'i henüz uygulamadı (501); mock'u aç |
| "Backend'e ulaşılamıyor" | Repo kökünde `docker compose up -d` çalıştır |
| Tip hatası: alan bulunamadı | Backend şeması değişmiş: `npm run gen:api`, sonra `fixtures.ts`'i düzelt |
