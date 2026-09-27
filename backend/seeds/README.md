# Seed — kampüs şablonu ve demo verisi

Veritabanını tek komutla kullanılabilir hale getirir. **Tekrar çalıştırmak güvenlidir** (idempotent): kayıtlar
koduyla bulunur, varsa şablondaki değerlere güncellenir, yoksa eklenir. Admin'in panelden eklediği kayıtlara
dokunulmaz.

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m seeds.run          # yalnız kampüs şablonu
docker compose exec backend python -m seeds.run --demo   # + demo kullanıcıları
```

`--demo` için `.env` dosyasında `SEED_DEMO_PASSWORD` olmalı (`.env.example`'da yerel bir değer var; en az
8 karakter). `.env`'yi değiştirdiysen önce `docker compose up -d backend` ile container'ı yenile.

## Ne yüklenir?

| Dosya | İçerik | Kaynak |
|---|---|---|
| `templates/campus/departments.yaml` | Kurum (İzmir Bakırçay Üniversitesi) + 5 departman (şube müdürlüğü) | [DEPARTMENTS.md](../../docs/DEPARTMENTS.md) §2 |
| `templates/campus/case_types.yaml` | 19 bildirim tipi: kategori, birincil/ikincil birim, öncelik, ciddiyet, anahtar kelimeler | DEPARTMENTS.md §3 |
| `templates/campus/locations.yaml` | Örnek kampüs ağacı: 3 bina, katlar, WC, derslik, lab, yemekhane, otopark (**temsili**, gerçek plan değil) | — |
| `demo/users.yaml` | Her rolden demo kullanıcı (yalnız `--demo`) | — |

**Önce DEPARTMENTS.md değişir, sonra YAML.** Uyumsuzluk CI'da yakalanır (`scripts/tests/test_departments_sync.py`).

## Demo kullanıcıları

Hepsinin parolası `SEED_DEMO_PASSWORD`. Adresler `example.com` altında: gerçek bir posta kutusuna gitmez.

| E-posta | Rol | Birim / tür |
|---|---|---|
| `admin@kampus.example.com` | ADMIN | — |
| `mudur.destek@kampus.example.com` | MANAGER | Destek Hizmetleri |
| `mudur.bakim@kampus.example.com` | MANAGER | Bakım Onarım |
| `temizlik@kampus.example.com` | STAFF | Destek Hizmetleri |
| `guvenlik@kampus.example.com` | STAFF | Destek Hizmetleri |
| `teknisyen@kampus.example.com` | STAFF | Bakım Onarım |
| `bt@kampus.example.com` | STAFF | BT Destek |
| `yemekhane@kampus.example.com` | STAFF | Beslenme |
| `ogrenci@kampus.example.com` | REPORTER | Öğrenci |
| `akademisyen@kampus.example.com` | REPORTER | Akademisyen |
| `personel@kampus.example.com` | REPORTER | Personel |

## Güvenlik

- `--demo` **production'da reddedilir** (bilinen parolalı hesaplar canlıya çıkmasın). Staging'de jüri demosu için
  kullanılabilir; orada `SEED_DEMO_PASSWORD` Render panelinde güçlü bir değerle verilir.
- Var olan demo kullanıcısının parolası seed ile ezilmez.
- Hatalı YAML (yanlış alan adı, bilinmeyen enum, aralık dışı değer) DB'ye dokunmadan reddedilir.

## Henüz yüklenmeyenler

- Otonomi seviyesi (`autonomy`) YAML'da duruyor; `agent_policies` tablosu FAZ 5'te gelince seed'e eklenecek.
- SLA kuralları FAZ 4'te, birimlerin "Hizmet Envanteri ve Standartları" sürelerinden.
