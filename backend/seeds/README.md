# Seed — kampüs şablonu ve demo verisi

Veritabanını tek komutla kullanılabilir hale getirir. **Tekrar çalıştırmak güvenlidir** (idempotent): kayıtlar
koduyla bulunur, varsa şablondaki değerlere güncellenir, yoksa eklenir. Admin'in panelden eklediği kayıtlara
dokunulmaz.

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m seeds.run          # yalnız kampüs şablonu
docker compose exec backend python -m seeds.run --demo   # + demo kullanıcıları
docker compose exec backend python -m seeds.run --demo --history   # + son 60 günün demo geçmişi (~1,5 dk)
```

`--demo` için `.env` dosyasında `SEED_DEMO_PASSWORD` olmalı (`.env.example`'da yerel bir değer var; en az
8 karakter). `.env`'yi değiştirdiysen önce `docker compose up -d backend` ile container'ı yenile.

## Ne yüklenir?

| Dosya | İçerik | Kaynak |
|---|---|---|
| `templates/campus/departments.yaml` | Kurum (İzmir Bakırçay Üniversitesi) + 5 departman (şube müdürlüğü) | [DEPARTMENTS.md](../../docs/DEPARTMENTS.md) §2 |
| `templates/campus/case_types.yaml` | 19 bildirim tipi: kategori, birincil/ikincil birim, öncelik, ciddiyet, anahtar kelimeler | DEPARTMENTS.md §3 |
| `templates/campus/locations.yaml` | Örnek kampüs ağacı: 3 bina, katlar, WC, derslik, lab, yemekhane, otopark (**temsili**, gerçek plan değil) | — |
| `templates/campus/sla_rules.yaml` | SLA hedef süreleri: öncelik başına varsayılan + 8 bildirim tipine özel (**varsayım**, resmi süreler teyit edilince değişir) | DEPARTMENTS.md §4 |
| `demo/users.yaml` | Her rolden demo kullanıcı (yalnız `--demo`) | — |
| `demo/history.yaml` | Demo geçmişinin senaryosu: cümleler, tür → yer, ağırlıklar, gömülü örüntüler, birim profilleri (yalnız `--history`) | — |

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

## Demo geçmişi (`--history`, E6-1)

Dashboard ve tezdeki ölçümler için son 60 günün verisi. **Elle uydurulmaz:** simülasyon saati geçmişte ilerler,
her bildirim gerçek agent hattından geçer, personel görevi gerçek servislerle kabul edip tamamlar, Resolution ve
Monitoring çalışır (`seeds/history.py`). Böylece olay kaydı, agent kararları, SLA ve süreler uygulamayla tutarlı.

- Bildirimler `is_seed = true`; bir kez üretilir (tohumlanmış bildirim varsa dokunmaz). Belirlenimci (sabit tohum).
- Tam plan: ~530 bildirim, ~30-40 açık (son 90 dakikada gelenler + Bakım Onarım kuyruğu), ~%77 SLA uyumu,
  ~%75 otomatik atama, ortalama puan ~4,3. Personel 08-20 çalışır (pazar kapalı); mesai dışı bildirim sabahı bekler.
- 24 ek öğrenci (`ogrenci01..24@kampus.example.com`) ve 3 ek personel eklenir (parola aynı).
- **Gömülü örüntüler (RQ4'ün doğru cevabı)**, son 30 günde:

| Yer | Tür | Sayı | Anlam |
|---|---|---|---|
| B Blok zemin WC (`B-Z-WC`) | Sabun bitti | 17 | sabunluk kapasitesi yetersiz |
| Yemekhane salonu (`YMK-SAL`) | Çöp dolu | 12 | öğleden sonra çöp kutuları taşıyor |
| A-101 Amfi | Projeksiyon arızası | 8 | projektör ömrünü doldurmuş |
| B Blok asansör (`B-ASN`) | Asansör arızası | 6 | sık arıza |

  Ayrıca: **Bakım Onarım kabulde yavaş** (medyan ~3,5 sa; diğer birimler 20-40 dk) → süreç analitiğinde darboğaz.
  Aynı sorunu dakikalar içinde 2-4 kişinin bildirdiği 15 olay → Duplicate Agent birleştirir.
