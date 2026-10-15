# Gerçek Veri Toplama — Anonim Google Form

Amaç: sınıflandırma modelinin **gerçek** başarısını ölçmek. Model şimdiye kadar yalnız sentetik cümlelerle
ölçüldü ([AGENTS.md](AGENTS.md) bölüm 6); tezdeki asıl sonuç, insanların kendi yazdığı bildirimlerle ölçülür.
Hedef: **300–500 cümle**, 2 kişi bağımsız etiketler, uyum Cohen's kappa ile raporlanır.

```
Google Form ──► Google Sheets ──► CSV indir ──► prepare ──► iki etiketçi ──► merge ──► data/labeled/real.csv ──► evaluate_model
                                                (maskeleme,          (A ve B           (kappa, anlaşmazlıklar)
                                                 temizleme)          ayrı dosya)
```

## 1. Form metni (Google Forms'a birebir kopyalanır)

> Soru başlıkları **değiştirilmez**: `ai/training/form_data.py` cevapları bu başlıklarla okur.
> Bir başlık değişecekse script'teki sabit de aynı PR'da değişir.

**Form başlığı:** BakırçayFlow — Kampüs sorunu yaz (anonim)

**Form açıklaması:**

> Merhaba! İzmir Bakırçay Üniversitesi YBS bitirme projesi olarak kampüsteki sorunların (bitmiş sabun,
> bozuk projeksiyon, çekmeyen Wi-Fi…) doğru birime kendiliğinden yönlendirildiği bir uygulama geliştiriyoruz.
> Uygulamadaki yapay zekânın gerçek cümleleri ne kadar doğru anladığını ölçmek için senin yazdığın örneklere
> ihtiyacımız var.
>
> Kampüste gördüğün ya da görebileceğin bir sorunu, bir bildirim uygulamasına yazar gibi yaz. Yazım hatası,
> kısaltma, günlük dil sorun değil; tam da öyle yazılanları görmek istiyoruz. Yaklaşık 1 dakika sürer,
> istersen formu birden fazla kez doldurabilirsin.

**Bölüm 1 — Soru 1: `Aydınlatma metni`** (Çoktan seçmeli, **zorunlu**)

Soru açıklaması:

> **Kişisel Verilerin Korunması (KVKK) hakkında bilgilendirme**
> - Bu form **anonimdir**. Adın, e-postan, öğrenci numaran ya da başka bir kimlik bilgin **istenmez ve kaydedilmez**.
> - Kaydedilen tek şey yazdığın sorun cümleleri ve gönderim zamanıdır.
> - Cümleler yalnız bitirme projesinde yapay zekâ modelini **ölçmek ve geliştirmek** için kullanılır; anonim
>   cümleler tezde örnek olarak alıntılanabilir. Ticari amaçla kullanılmaz, üçüncü kişilerle paylaşılmaz.
> - Lütfen cümlede **isim, telefon numarası, e-posta ya da numara yazma.** Yanlışlıkla yazılırsa ekip
>   bunları etiketlemeden önce siler.
> - Veriler proje ekibinin Google hesabında tutulur ve proje teslim edildikten sonra silinir.
> - Sorun ve talepler için: [ekip iletişim e-postası].

Tek seçenek:
- `Okudum, anonim yanıtlarımın bu amaçla kullanılmasını kabul ediyorum.`

**Soru 2: `Kampüste gördüğün bir sorunu yaz`** (Paragraf, **zorunlu**)

Soru açıklaması:

> Bildirim uygulamasına yazar gibi yaz: ne oldu, nerede? Örnekler: "B blok 2. kat erkek tuvaletinde sabun
> bitmiş", "kütüphanede wifi çekmiyo", "amfi 3'te projeksiyon açılmıyor ders başlıcak". İsim, telefon ya da
> numara yazma.

Yanıt doğrulama: **Uzunluk → En az karakter sayısı → 10**, hata metni: `En az 10 karakter yaz.`
(Uygulamadaki bildirim formuyla aynı sınır.)

**Soru 3: `Aklına gelen başka bir sorun varsa onu da yaz`** (Paragraf, isteğe bağlı)

Soru açıklaması:

> Farklı bir sorun olsun: örneğin temizlik, elektrik, internet, yemekhane, güvenlik, asansör, bahçe…

**Gönderim sonrası mesaj:**

> Teşekkürler! Yanıtın kaydedildi. Bir sorun daha yazmak istersen "Başka bir yanıt gönder"e bas.

### Google Forms ayarları

| Ayar | Değer | Neden |
|---|---|---|
| Ayarlar → Yanıtlar → **E-posta adreslerini topla** | **Toplama** | Anonimlik (KVKK) |
| **Oturum açma zorunluluğu / 1 yanıtla sınırla** | **Kapalı** | Hesap istenmez; birden fazla cümle gelebilsin |
| Yanıt gönderildikten sonra **düzenlemeye izin ver** | Kapalı | — |
| Sunum → **Yanıt özetini göster** | Kapalı | Başkalarının cümleleri görünmesin |
| Yanıtlar → **Sheets'e bağla** | Açık | CSV buradan indirilir |

Form linki yalnız ekip ve sınıf/bölüm gruplarında paylaşılır. Formu ekip onaylamadan yayınlama (PR yorumu).

## 2. Temizleme ve etiketleme dosyaları

Sheets → **Dosya → İndir → CSV**. Dosya `ai/data/raw/form_responses.csv` adıyla konur (`raw/` git'e girmez).

```bash
cd ai
uv run python -m training.form_data prepare --responses data/raw/form_responses.csv
```

Script şunları yapar (`ai/training/form_data.py`, testleri `ai/tests/test_form_data.py`):
- Onay vermeyen satırları atar; iki cümle sorusunu ayrı cümleler olarak alır.
- Fazla boşlukları düzeltir; 10 karakterden kısa ve tekrar eden (büyük/küçük harf farkıyla aynı) cümleleri atar.
- Yine de yazılmış **e-posta → `[e-posta]`, telefon → `[telefon]`, 9+ haneli sayı → `[numara]`** olarak maskeler.
- `ai/data/raw/labeling/labeler_a.csv` ve `labeler_b.csv` yazar: aynı satırlar, karışık sırada, `label` boş.

## 3. Etiketleme rehberi (2 kişi, birbirinden bağımsız)

- Her etiketçi **yalnız kendi dosyasını** açar, diğerine bakmaz, konuşmaz. `label` sütununa **tür kodu** yazar.
- Bir cümle = bir tür. Birden fazla sorun varsa **ilk/ana** sorunu seç.
- Geçerli kodlar ve anlamları: [DEPARTMENTS.md](DEPARTMENTS.md) bölüm 3 "Bildirim tipleri" (19 kod, ör.
  `SOAP_EMPTY`, `WIFI_FAILURE`, `PROJECTOR_FAILURE`). Kampüs fiziksel sorunu ama hiçbir türe uymuyorsa `OTHER`;
  tesis dışı talepse (not düzeltme, burs, ders kaydı…) `OUT_OF_SCOPE`.
- Bilinmeyen kod ya da boş etiket `merge` adımında satır numarasıyla hata verir; düzeltip tekrar çalıştır.

## 4. Birleştirme ve uyum (kappa)

```bash
uv run python -m training.form_data merge
```

- İki etiketçinin **aynı** kodu verdiği cümleler `ai/data/labeled/real.csv`'ye (`text,label`) girer.
- Farklı kodlar `ai/data/raw/labeling/disagreements.csv`'ye yazılır. Ekip birlikte bakar, `final` sütununa kararı
  yazar ve `merge`'ü tekrar çalıştırır; çözülenler de `real.csv`'ye eklenir.
- Ekrana `satır | uyuşan | ekipçe çözülen | kalan anlaşmazlık | kappa | uyum %` yazılır. **Kappa ilk birleştirmede
  (çözümden önce) not edilir**; tezde raporlanan uyum budur. Yorum: 0,61–0,80 iyi, 0,81 üstü çok iyi.
- `real.csv` anonimdir ve repoya girer; ham form CSV'si ve etiketleme dosyaları girmez.

## 5. Ölçüm

```bash
uv run python -m training.evaluate_model --model models/classifier/v1/model.joblib --data data/labeled/real.csv
```

Sonuç tezdeki "gerçek veri" başarısıdır ([AGENTS.md](AGENTS.md) 6.3); sentetik sonuçla karşılaştırılarak raporlanır.
