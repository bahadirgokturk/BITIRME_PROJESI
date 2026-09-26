# ONBOARDING — Ekip Üyesi Kurulum Rehberi

Bu rehberi baştan sona bir kez uygulayınca projeyi kendi bilgisayarında çalıştırabilir ve
katkı yapabilirsin. Süre: ~30 dk (Docker indirme hariç).

## 1. Gerekli programlar

| Program | Sürüm | Neden | İndirme |
|---|---|---|---|
| Git | 2.40+ | Kod | git-scm.com |
| Docker Desktop | güncel | Frontend + backend + Postgres'i tek komutla çalıştırmak | docker.com (Windows'ta WSL2 backend'i seç) |
| VS Code | güncel | Editör (önerilen eklentiler repo açılınca otomatik önerilir) | code.visualstudio.com |
| Node.js | 20 LTS | Frontend'i Docker dışında çalıştırmak / editör desteği | nodejs.org |
| Python + uv | 3.12 | Backend/AI'ı Docker dışında çalıştırmak / editör desteği | python.org, `pip install uv` |

> Günlük geliştirme için **Git + Docker Desktop yeterli**. Node ve Python editörde otomatik tamamlama,
> lint ve testleri hızlı çalıştırmak için önerilir.

## 2. GitHub erişimi

1. Repo sahibi (Bahadır) seni **Settings → Collaborators** üzerinden davet eder; e-postadaki daveti kabul et.
2. Git kimliğini ayarla (commit'lerde görünecek):

```bash
git config --global user.name "Ad Soyad"
```

```bash
git config --global user.email "github-e-postan@example.com"
```

## 3. Repoyu klonla — OneDrive DIŞINA

`node_modules`, `.venv` ve veritabanı dosyaları OneDrive/Dropbox senkronizasyonunda build'i çok
yavaşlatır ve dosya kilidi hatası verir. Senkronize olmayan bir klasör kullan:

```bash
mkdir C:\dev
```

```bash
git clone https://github.com/bahadirgokturk/BITIRME_PROJESI.git C:\dev\campusflow
```

```bash
cd C:\dev\campusflow
```

## 4. Ortamını kontrol et

Windows (PowerShell):

```bash
powershell -ExecutionPolicy Bypass -File scripts\check-setup.ps1
```

macOS/Linux:

```bash
bash scripts/check-setup.sh
```

Script eksik program, yanlış sürüm, OneDrive klasörü, eksik git kimliği gibi sorunları listeler.

## 5. Projeyi çalıştır

```bash
copy .env.example .env
```

Veritabanı ve backend Docker'da çalışır:

```bash
docker compose up --build -d
```

İlk açılışta (ve her yeni migration geldiğinde) veritabanı şemasını güncelle:

```bash
docker compose exec backend alembic upgrade head
```

Frontend **Docker dışında**, doğrudan bilgisayarda çalışır (Docker içinde dosya değişikliklerini göremediği için
hot reload çalışmıyor). İkinci bir terminalde:

```bash
cd frontend
```

```bash
npm ci
```

```bash
npm run dev
```

- Frontend: http://localhost:3000 — "Sistem durumu" kartında iki **yeşil** satır görmelisin: "Backend çalışıyor", "Veritabanı bağlı"
- Backend API dokümanı: http://localhost:8000/docs
- Testler: `docker compose exec backend pytest` · frontend için `cd frontend` ve `npm test`
- Demo kullanıcıları seed ile FAZ 2'de gelecek (`backend/seeds/README.md`).

## 6. Günlük çalışma akışı

```bash
git checkout develop
```

```bash
git pull
```

```bash
git checkout -b feature/kisa-aciklama
```

… kodla, test yaz, commit at (`feat(cases): add case creation endpoint`) …

```bash
git push -u origin feature/kisa-aciklama
```

Sonra GitHub'da **develop'a** Pull Request aç ve PR şablonunu doldur. Onay gerekmez: CI yeşilse
**kendin Squash and merge** yap ve branch'i sil. (Bahadır otomatik reviewer olarak görünür; bu develop
için bilgi amaçlıdır, bekleme.) Canlıya geçiş (`develop → main`) Bahadır'ın onayıyla yapılır.

Kurallar:
- `main` ve `develop`'a doğrudan push yok.
- Her gün işe başlarken `develop`'u çek; uzun yaşayan branch'lerde `git merge develop` ile güncel kal.
- Bir PR tek bir iş yapar; 400 satırı geçiyorsa bölmeyi düşün.

## 7. AI asistanıyla kod yazdırırken

- Repo kökündeki [CLAUDE.md](../CLAUDE.md) Claude Code tarafından otomatik okunur.
  Başka bir asistan (Copilot, Cursor, ChatGPT) kullanıyorsan önce ona [KOD_KURALLARI.md](../KOD_KURALLARI.md)
  ve ilgili `docs/` dosyasını ver.
- AI'ın yazdığı kod da **senin** kodundur: çalıştır, testini gör, anla, sonra commit et.
- AI'dan önce test yazmasını iste (TDD — kural 4).

## 8. Neyi nerede bulurum?

| Soru | Doküman |
|---|---|
| Sistem nasıl çalışıyor? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Tablo/kolon ne? | [DATABASE.md](DATABASE.md) |
| Case hangi durumdan hangisine geçer, kim ne yapabilir? | [WORKFLOW.md](WORKFLOW.md) |
| Agent'lar nasıl karar veriyor? | [AGENTS.md](AGENTS.md) |
| Bu hafta ne yapıyoruz? | [PROJECT_PLAN.md](PROJECT_PLAN.md) |
| Ekranlar nasıl tasarlanır (Figma → kod)? | [UI_GUIDE.md](UI_GUIDE.md) |
| Kod nasıl yazılır? | [KOD_KURALLARI.md](../KOD_KURALLARI.md), [CONVENTIONS.md](CONVENTIONS.md) |

## 9. Sık sorunlar

| Sorun | Çözüm |
|---|---|
| `docker: command not found` / daemon çalışmıyor | Docker Desktop'ı başlat, WSL2 kurulu mu kontrol et (`wsl --status`) |
| `port is already allocated` (5433) | `.env`'de `POSTGRES_HOST_PORT`'u başka bir değere (ör. 5434) çek. Bilgisayardaki PostgreSQL'i kapatmaya gerek yok |
| Port 3000/8000 dolu | Çakışan programı kapat |
| "Ortak veritabanına bağlanalım" önerisi | Gerek yok: herkes `docker compose` ile **kendi** DB'sini çalıştırır; şema migration'la, demo verisi seed ile herkeste aynı olur |
| Satır sonu (CRLF) farkları diff'te görünüyor | Repo `.gitattributes` ile LF kullanır; `git config --global core.autocrlf false` ayarla ve dosyayı yeniden checkout et |
| Build çok yavaş | Repo OneDrive içinde mi? `C:\dev` altına taşı |
