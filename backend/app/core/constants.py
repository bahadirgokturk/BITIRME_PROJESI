"""Is kurali sabitleri; her deger nedeniyle birlikte yazilir (KOD_KURALLARI kural 7)."""

# Lokasyon onemi 0-100 olcegindedir; Priority Agent bunu 0-15 katkiya olcekler (docs/AGENTS.md)
IMPORTANCE_WEIGHT_MIN = 0
IMPORTANCE_WEIGHT_MAX = 100

# Liste sayfalama (docs/API.md): 20 kayit mobil ekrana sigar;
# 200 ust sinir admin lokasyon agacini tek istekte getirebilsin diye
PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 200
