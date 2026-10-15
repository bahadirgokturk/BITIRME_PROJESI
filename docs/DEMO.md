# Demo Senaryosu (sunum)

Sunumda gösterilecek akış: yaklaşık **8–10 dakika**, dört rol, iki bildirim. Amaç, jüriye sistemin özgün tarafını
göstermek: **yapay zekâ kararını kendisi verir, nedenini açıklar ve emin olamadığında insana bırakır.**

Bu akış 16 Ekim 2026'da yerelde gerçek backend ve agent'larla baştan sona yürütüldü; her adım beklendiği gibi çalıştı.
Aynı adımlar otomatik testlerde de var (`frontend/e2e-real/`, [TESTING.md](TESTING.md)).

## Hazırlık (sunumdan önce, bir kez)

1. Temiz veritabanı ve dolu panolar için veritabanını sıfırlayıp demo geçmişiyle yükle (yerel veritabanını siler,
   GitHub'a ve arkadaşlarının bilgisayarına dokunmaz):

   ```bash
   docker compose down -v
   docker compose up -d
   docker compose exec backend alembic upgrade head
   docker compose exec backend python -m seeds.run --demo --history
   ```

   `--history` son 60 günün örnek bildirimlerini yükler (~1,5 dk); Genel Bakış, Raporlar ve Yapay Zekâ Performansı
   boş görünmez. Ayrıntı: [backend/seeds/README.md](../backend/seeds/README.md).
2. Siteyi aç: `cd frontend && npm run dev` → `http://localhost:3000`.
3. İki pencere hazırla: **telefon görünümü** (tarayıcı geliştirici araçlarında cihaz modu ya da gerçek telefon) bildiren
   ve personel için; **masaüstü** müdür ve yönetici için. Her pencerede ayrı oturum açmak için ikinciyi gizli pencere yap.
4. Hesaplar `backend/seeds/README.md` tablosunda; parola `.env` dosyasındaki `SEED_DEMO_PASSWORD`. Parola slayta ve
   ekrana yazılmaz.

| Rol | Hesap | Pencere |
|---|---|---|
| Bildiren (öğrenci) | `ogrenci@kampus.example.com` | telefon |
| Personel | `temizlik@` ya da `guvenlik@` (görev hangisine düştüyse) | telefon |
| Birim müdürü | `mudur.destek@kampus.example.com` | masaüstü |
| Sistem yöneticisi | `admin@kampus.example.com` | masaüstü |

## Akış

### 1. Bildiren sorunu bildirir (telefon, ~1 dk)

- **Bildirim Yap** → "Erkek tuvaletinde sabun bitmiş, sabunluklar boş." → konum **B Blok Zemin Kat WC** →
  isteğe bağlı fotoğraf → **Gönder**.
- "Bildiriminiz alındı" ekranından **Bildirimlerim** → bildirimi aç. Birkaç saniye içinde zaman çizelgesinde
  "İlgili birime yönlendirildi" görünür.
- **Söylenecek:** "Öğrenci yalnız ne olduğunu ve nerede olduğunu yazdı; türü, önceliği ve birimi kendisi seçmedi."

### 2. Müdür yapay zekânın kararını okur (masaüstü, ~2 dk) — **sunumun kalbi**

- **Tüm Bildirimler** → numarayla ara → bildirimi aç.
- **Yapay zekâ kararları** bölümünü yukarıdan aşağı göster: Sınıflandırma (tür + güven %), Tekrar kontrolü,
  Öncelik (gerekçe maddeleri ve ağırlıkları), Yönlendirme (neden bu personel), Karar.
- **Söylenecek:** "Her adım bir gerekçe ve kullanılan model ile kayıtlı. Ücretli bir dil modeli yok; kendi eğittiğimiz
  sınıflandırıcı ve kurallar."

### 3. Personel işi yapar (telefon, ~1,5 dk)

- Personel hesabıyla gir → **Görevlerim**'de görev en üstte, kalan süre rozetiyle.
- **Kabul et** → **Başlat** → **Tamamla**: not + kanıt fotoğrafı.
- **Söylenecek:** "İş kontrolü adımı kanıta bakıp bildirimi kendisi kapatır; kanıt yetersizse görevi geri gönderir."

### 4. Bildiren puanlar ve yorum yazar (telefon, ~1 dk)

- Bildirenin bildiriminde "Sorun çözüldü mü?" kartı → 5 yıldız → **Değerlendirmeyi gönder**.
- **Yorumlar** → "Teşekkürler, hızlı çözüldü." → **Gönder**.
- İsteğe bağlı: personel ya da müdür **iç not** yazar; bildirenin ekranında görünmediğini göster.

### 5. Yapay zekâ emin olmayınca insana bırakır (~2 dk)

- Bildiren: "Salonda priz kıvılcım çıkarıyor, yanık kokusu var." → konum **Yemekhane Salonu**.
- Müdür: **İnceleme Kuyruğu** → kartta "Yöneticiye iletildi", **Neden burada?** satırı ve **Yapay zekâ gerekçesi**
  (güvenlikle ilgili ifadeler önceliği kritiğe çıkarır).
- Bildirimi aç → "Bu bildirim kararınızı bekliyor" kutusu → **Onayla ve ata**.
- **Söylenecek:** "Güvenlik riski olan işi sistem tek başına atamıyor; karar ve sorumluluk müdürde. İsterse türü,
  önceliği ya da birimi düzeltir; düzeltmeler modelin yeniden eğitimi için kaydedilir."

### 6. Müdürün özet ekranları (masaüstü, ~1 dk)

- **Genel Bakış:** göstergeler, açılan/kapanan grafiği, **Yapay zekâ yönetim özeti**.
- **Raporlar:** en yoğun bina, birim performansı, tekrarlayan sorunlar.
- **Yapay Zekâ Performansı:** otomasyon oranı, müdür incelemesi oranı, düzeltilme oranları.

### 7. Yönetici denetimi (masaüstü, ~1 dk)

- **Yönetim → Yapay Zekâ Politikaları:** bir türün karar yetkisini "Müdür karar verir" yap (insan denetimi ayarı).
- **İşlem Kayıtları:** az önceki değişiklik kim, ne zaman, neyi değiştirdi diye görünür.
- Değişikliği geri al (sunumdan sonra veriler karışmasın).

### 8. (İsteğe bağlı) Aynı sorun ikinci kez bildirilir (~1 dk)

- Bildiren: "Erkek tuvaletinde sabun bitmiş." → konum **A Blok Zemin Kat Erkek WC** (demo geçmişinde orada açık bir
  sabun bildirimi var).
- Bildirim yeni görev açmaz; zaman çizelgesinde "Aynı sorun zaten bildirilmiş, bildiriminiz oraya eklendi" görünür.
  Müdür detayında Tekrar kontrolü adımı "Aynı sorun bu yerde zaten bildirilmiş." der.
- **Söylenecek:** "Aynı sorun için ikinci bir ekip yola çıkmaz; bildirim mevcut kayda eklenir."

## Olası sürprizler ve yedek plan

- **Görev kime düştü?** Destek Hizmetleri'nde iki personel var; yapay zekâ en boşta olanı seçer ya da görevi birimin
  havuzuna açar. Personel hesabıyla girince görev yoksa diğer personel hesabını dene.
- **"Tekrar" sayıldı:** aynı binada açık aynı sorun varsa yeni bildirim ona birleştirilir. Konumlar bu yüzden seçildi:
  demo geçmişinde B Blok'ta açık sabun, Yemekhane'de açık elektrik bildirimi yok (16 Ekim provasında doğrulandı).
  Provadan kalan açık bildirim varsa sunum öncesi veritabanını yukarıdaki gibi sıfırla.
- **Canlı site (staging) yavaş ya da kapalı:** Render'ın ücretsiz sunucusu uyur; ilk istek 30–60 sn sürebilir.
  Sunumu yerelde yap; canlı siteyi yalnız "her an açılabilir" diye göster.
- **İnternet yok:** her şey yerelde çalışır (Docker + `npm run dev`); dış servise ihtiyaç yoktur.
