"""Turkce harflere duyarsiz arama: "kirik", "KIRIK" ve "Kırık" ayni metni bulur.

Iki taraf da ayni katlamadan gecer: Turkce harfler ASCII karsiligina iner, sonra kucuk harfe.
Once cevrilir ki "I"/"İ" kucuk harfe donerken yerel ayara (locale) bagli kalmasin.
"""

from sqlalchemy import ColumnElement, SQLColumnExpression, func

_TURKISH = "ÇĞİIÖŞÜçğıöşü"
_ASCII = "CGIIOSUcgiosu"
_TABLE = str.maketrans(_TURKISH, _ASCII)


def fold(text: str) -> str:
    return text.translate(_TABLE).lower()


def folded(column: SQLColumnExpression[str]) -> ColumnElement[str]:
    return func.lower(func.translate(column, _TURKISH, _ASCII))
