"""Turkce metin normalizasyonu (AGENTS.md 4.1). Tum agent'lar ve siniflandirici bunu kullanir;
egitimde (ai/) ve calisma aninda ayni donusum yapilmali, yoksa model farkli metin gorur.

Adimlar: Turkce kucuk harf (I -> noktasiz i, noktali I -> i) -> ASCII'ye katlama (c, g, i, o, s, u)
-> harf, rakam ve tire disindakiler bosluk -> tam kelime es anlamlilari -> bosluklar tekillesir.
"""

import re

# Turkce buyuk -> kucuk: Python'un lower()'i "I"yi "i" yapar, Turkcede noktasiz i olmali
_TURKISH_LOWER = str.maketrans({"I": "ı", "İ": "i"})
_ASCII_FOLD = str.maketrans("çğıöşüâîû", "cgiosuaiu")
_NON_WORD = re.compile(r"[^a-z0-9-]+")
_SPACES = re.compile(r"\s+")

# Yalniz kelimenin tamami eslenir (ekli bicimleri karakter n-gram modeli zaten yakalar)
SYNONYMS: dict[str, str] = {
    "wc": "tuvalet",
    "lavabo": "tuvalet",
    "hela": "tuvalet",
    "klozet": "tuvalet",
    "internet": "wifi",
    "wi-fi": "wifi",
    "kablosuz": "wifi",
    "projektor": "projeksiyon",
}


def normalize(text: str) -> str:
    folded = text.translate(_TURKISH_LOWER).lower().translate(_ASCII_FOLD)
    words = _NON_WORD.sub(" ", folded).split()
    # Kelime basindaki/sonundaki tire anlamsizdir; "a-101" gibi ic tireler kalir
    cleaned = (word.strip("-") for word in words)
    return _SPACES.sub(" ", " ".join(SYNONYMS.get(w, w) for w in cleaned if w)).strip()
