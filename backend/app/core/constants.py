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
