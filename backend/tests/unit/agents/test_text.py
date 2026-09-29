"""Turkce normalizasyon: agent'lar ayni sorunu farkli yazimlarda ayni gorsun (AGENTS.md 4.1)."""

import pytest

from app.agents.text import normalize


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # Turkce buyuk harf: I -> noktasiz i, noktali I -> i; sonra ASCII'ye katlanir
        ("IŞIK YANMIYOR", "isik yanmiyor"),
        ("İKİNCİ KAT", "ikinci kat"),
        ("Sabunluk BOŞ!!!", "sabunluk bos"),
        ("  çok   pis,  koku  var  ", "cok pis koku var"),
        # Es anlamlilar tek kelimeye: WC / lavabo -> tuvalet
        ("B blok WC'de sabun yok", "b blok tuvalet de sabun yok"),
        ("lavabo kirli", "tuvalet kirli"),
        # Yalniz kelimenin tamami eslenir; ekli bicime dokunulmaz ("tuvaletda" olusmasin)
        ("lavaboda kagit havlu bitti", "lavaboda kagit havlu bitti"),
        # Oda kodlarindaki tire ve rakamlar korunur
        ("A-101 amfi", "a-101 amfi"),
    ],
)
def test_normalize(raw: str, expected: str) -> None:
    assert normalize(raw) == expected


def test_ascii_and_turkish_spellings_become_equal() -> None:
    assert normalize("tuvalette sabun kalmamış") == normalize("tuvalette sabun kalmamis")
