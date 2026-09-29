"""Is kurali sabitleri; her deger nedeniyle birlikte yazilir (KOD_KURALLARI kural 7)."""

# Lokasyon onemi 0-100 olcegindedir; Priority Agent bunu 0-15 katkiya olcekler (docs/AGENTS.md)
IMPORTANCE_WEIGHT_MIN = 0
IMPORTANCE_WEIGHT_MAX = 100

# Bildirim tipinin baslangic ciddiyeti 0-100; Priority Agent diger sinyallerle birlestirir
SEVERITY_MIN = 0
SEVERITY_MAX = 100

# Liste sayfalama (docs/API.md): 20 kayit mobil ekrana sigar;
# 200 ust sinir admin lokasyon agacini tek istekte getirebilsin diye
PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 200

# Rotasyonla yenilenmis refresh token bu sure icinde tekrar gelirse ayni kullanicinin es zamanli
# istegi (iki sekme) sayilir: yalniz reddedilir, oturumlar kapatilmaz. Sonrasinda gelirse calinma
# belirtisidir ve tum oturumlar kapatilir. 10 sn: yavas mobil agda bile iki istegi kapsar,
# saldirganin firsat penceresini de dar tutar.
REFRESH_REUSE_GRACE_SECONDS = 10

# Giris hiz siniri (OWASP Authentication Cheat Sheet): 15 dk'da e-posta basina 5 hatali deneme
# unutkan kullaniciya yeter, kaba kuvvet icin cok azdir. IP basina 20: bir sinifin ayni
# kampus NAT'indan girisini engellemez, farkli e-postalarla deneme yapan saldirgani durdurur.
LOGIN_MAX_FAILURES_PER_EMAIL = 5
LOGIN_MAX_FAILURES_PER_IP = 20
LOGIN_FAILURE_WINDOW_MINUTES = 15
# Bellek korumasi: bu kadar anahtar birikince suresi dolanlar temizlenir
LOGIN_LIMITER_PRUNE_THRESHOLD = 10_000

# Bildirim aciklamasi: 10 karakter "sabun yok" gibi en kisa anlamli cumleyi gecer, bos/tek kelime
# bildirimleri eler; 2000 karakter uzun bir anlatima yeter, siniflandiriciya asiri metin gitmez
CASE_DESCRIPTION_MIN_LENGTH = 10
CASE_DESCRIPTION_MAX_LENGTH = 2000
CASE_TITLE_MAX_LENGTH = 200
# Baslik girilmezse aciklamanin ilk 60 karakteri: liste satirina tek satirda sigar
CASE_TITLE_FROM_DESCRIPTION_LENGTH = 60
# CASE-000124: 6 hane bir kampuste yillarca yeter (999.999 bildirim)
CASE_NUMBER_PREFIX = "CASE-"
CASE_NUMBER_DIGITS = 6

# Fotograf yukleme (docs/ARCHITECTURE.md bolum 9): telefon fotografi sikistirilinca 5 MB'a sigar
MAX_UPLOAD_MB_DEFAULT = 5
BYTES_PER_MB = 1024 * 1024
# Bir bildirime en fazla 5 fotograf: olayi gostermeye yeter, depolama kotuye kullanilamaz
MAX_ATTACHMENTS_PER_CASE = 5
# Kaydedilen dosya adi (original_name) siniri; tam ad yalniz gosterim icin
ATTACHMENT_NAME_MAX_LENGTH = 255

# Video: 30 sn bir arizayi gostermeye yeter. 1080p telefon videosu ~1-2 MB/sn -> 50 MB
MAX_VIDEO_SECONDS = 30
MAX_VIDEO_MB_DEFAULT = 50
# Telefon "30 sn" kaydini 30,0x sn olarak yazabilir; yarim saniye pay
VIDEO_DURATION_TOLERANCE_SECONDS = 0.5

# Bildirim yapan, kapanistan sonra 72 saat icinde "sorun devam ediyor" diyebilir ve puan verebilir
# (docs/WORKFLOW.md): hafta sonunu kapsar, eski isler suresiz acik kalmaz
REOPEN_WINDOW_HOURS = 72
COMMENT_MAX_LENGTH = 2000
REOPEN_REASON_MAX_LENGTH = 1000
# Memnuniyet puani 1-5 yildiz (cases.satisfaction_rating CHECK ile ayni)
RATING_MIN = 1
RATING_MAX = 5

# Gorev reddi ve tamamlama notu uzunlugu
TASK_NOTE_MAX_LENGTH = 1000

PERCENT = 100
# SLA: kalan surenin %75'i gecince "riskte" (UI_GUIDE bolum 4.1 AT_RISK). Kural kendi esigini tasir;
# bu yalniz yeni kural icin varsayilan
SLA_WARNING_PCT_DEFAULT = 75
# Oncelik henuz belirlenmemisse (Priority Agent FAZ 5) SLA icin kullanilan oncelik: orta
SLA_FALLBACK_PRIORITY = "MEDIUM"
