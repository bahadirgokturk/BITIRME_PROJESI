# CONVENTIONS — Stil Ayrıntıları & Definition of Done

Bağlayıcı ilkeler (fail fast, az dallanma, İngilizce isim / ASCII Türkçe yorum, TDD, sihirli sayı,
katman sınırları…) **[KOD_KURALLARI.md](../KOD_KURALLARI.md)** içindedir. Bu dosya dile/araca özgü
stil ayrıntılarını ve Definition of Done'ı içerir.

## Genel
- Dokümanlar ve UI metinleri Türkçe; kod tanımlayıcıları İngilizce.
- Tekrar eden kod yerine küçük yardımcılar; ama erken soyutlama yok (3. tekrarda soyutla).

## Python (backend, ai)
- Python 3.12, tam type hint, `mypy --strict` (app/ ve agents/ için).
- `ruff` (lint + format), satır 100.
- İsimlendirme: `snake_case` fonksiyon/değişken, `PascalCase` sınıf, `UPPER_SNAKE` sabit.
- Pydantic v2 şemaları: `CaseCreate`, `CaseRead`, `CaseUpdate`; agent I/O: `<Agent>Input`, `<Agent>Output`.
- Servisler sınıf + bağımlılık enjeksiyonu (FastAPI `Depends`), repository'ler session alır.
- Hatalar domain exception (`NotFoundError`, `InvalidTransitionError`, `PermissionDeniedError`) →
  merkezi exception handler HTTP'ye çevirir.
- Zaman: her zaman timezone-aware UTC (`datetime.now(UTC)`), zaman sağlayıcı (`Clock`) enjekte edilir (test için).

## TypeScript (frontend)
- `strict: true`, `noUncheckedIndexedAccess: true`; `any` yasak (zorunluysa `unknown` + daraltma).
- API tipleri `openapi-typescript` ile üretilir (`src/lib/api/types.ts`), elle yazılmaz.
- Bileşenler `PascalCase.tsx`, hook'lar `useX.ts`; veri çekme TanStack Query.
- Form: react-hook-form + zod. Stil: Tailwind + shadcn/ui; renk/durum eşlemeleri tek dosyada (`lib/status.ts`).
- Erişilebilirlik: etiketli form alanları, klavye ile gezinme, renk + metin ile durum gösterimi.

## Veritabanı
- Şema değişikliği yalnızca Alembic migration; migration adı açıklayıcı; `downgrade` yazılır.
- Tablo adları çoğul `snake_case`; FK `<tablo_tekil>_id`; index `ix_<tablo>_<kolonlar>`.
- Seed idempotent.

## Definition of Done (her backlog maddesi için)
- [ ] Kabul kriterleri karşılandı, PR açıklamasında gösterildi
- [ ] [KOD_KURALLARI.md](../KOD_KURALLARI.md) ile uyumlu; PR şablonu dolduruldu
- [ ] Kod lint/format/typecheck temiz
- [ ] Kritik mantık için unit test; endpoint için integration test (mutlu yol + yetki)
- [ ] CI yeşil
- [ ] Proje sahibi (@bahadirgokturk) onayladı; kritik alanlarda bir ekip üyesi de inceledi
- [ ] Gerekli migration var ve `upgrade`/`downgrade` yerelde denendi
- [ ] İlgili `docs/*.md` güncellendi (API, DB, workflow, agent değişiklikleri)
- [ ] Yeni env değişkeni varsa `.env.example` güncellendi
- [ ] UI değişikliğinde ekran görüntüsü PR'da; mobil genişlikte kontrol edildi
- [ ] Staging'de çalıştığı doğrulandı (develop merge sonrası)
