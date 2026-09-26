"""Is kurali sabitleri; her deger nedeniyle birlikte yazilir (KOD_KURALLARI kural 7)."""

# Lokasyon onemi 0-100 olcegindedir; Priority Agent bunu 0-15 katkiya olcekler (docs/AGENTS.md)
IMPORTANCE_WEIGHT_MIN = 0
IMPORTANCE_WEIGHT_MAX = 100

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
