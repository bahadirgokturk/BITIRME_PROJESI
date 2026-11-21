"""Toplu kullanici yukleme icin CSV okuma (docs/API.md "admin/users/import").

Excel'in kaydettigi bicimler okunur: "CSV UTF-8" (BOM'lu, virgul) ve Turkce Windows'taki "CSV"
(Windows-1254, noktali virgul). Sutun adlari buyuk/kucuk harf ve bosluktan bagimsizdir; bos
satirlar atlanir. Dosya yapisi bozuksa (zorunlu sutun yok, satir yok, cok satir) dosya bastan
reddedilir; satir bazindaki hatalari UserService.import_users toplar.
"""

import csv
import io
from dataclasses import dataclass

from pydantic import ValidationError

from app.core import messages
from app.core.errors import InvalidImportFileError
from app.schemas.user import UserCreate

# 2.000 satir ~ 150 KB; 1 MB siniri tek seferde buyuk bir birim listesine yeter
IMPORT_MAX_BYTES = 1024 * 1024
IMPORT_MAX_ROWS = 2000
REQUIRED_COLUMNS = ("email", "full_name", "role")
OPTIONAL_COLUMNS = ("reporter_kind", "department_code")
DELIMITERS = ",;\t"
# Turkce Windows'ta Excel'in "CSV" kaydi bu kod sayfasidir
LEGACY_ENCODING = "cp1254"
# Basliktan sonraki ilk veri satirinin numarasi (Excel'deki satir numarasiyla ayni)
FIRST_DATA_ROW = 2


@dataclass(frozen=True)
class ImportRow:
    # Dosyadaki satir numarasi (baslik 1)
    row: int
    fields: dict[str, str]


def decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode(LEGACY_ENCODING)


def _dialect(text: str) -> type[csv.Dialect] | csv.Dialect:
    header = text.split("\n", 1)[0]
    try:
        return csv.Sniffer().sniff(header, delimiters=DELIMITERS)
    except csv.Error:
        # Tek sutunlu baslik ayirici gostermez; eksik sutun hatasi asagida verilir
        return csv.excel


def parse(text: str) -> list[ImportRow]:
    reader = csv.reader(io.StringIO(text), _dialect(text))
    header = [name.strip().lower() for name in next(reader, [])]
    missing = [column for column in REQUIRED_COLUMNS if column not in header]
    if missing:
        raise InvalidImportFileError(
            messages.IMPORT_MISSING_COLUMNS.format(columns=", ".join(missing))
        )
    known = [name if name in REQUIRED_COLUMNS + OPTIONAL_COLUMNS else "" for name in header]
    rows = [
        ImportRow(row=number, fields=_fields(known, values))
        for number, values in enumerate(reader, start=FIRST_DATA_ROW)
        if any(value.strip() for value in values)
    ]
    if not rows:
        raise InvalidImportFileError(messages.IMPORT_EMPTY)
    if len(rows) > IMPORT_MAX_ROWS:
        raise InvalidImportFileError(messages.IMPORT_TOO_MANY_ROWS.format(limit=IMPORT_MAX_ROWS))
    return rows


def _fields(header: list[str], values: list[str]) -> dict[str, str]:
    # Bilinmeyen sutunlar (bos ad) yok sayilir; eksik hucre bos deger sayilir
    padded = values + [""] * (len(header) - len(values))
    return {name: value.strip() for name, value in zip(header, padded, strict=False) if name}


@dataclass(frozen=True)
class ImportBatch:
    rows: list[ImportRow]
    # Herkese ayni gecici parola; ilk giriste degistirilir (must_change_password)
    password: str
    dry_run: bool


# Pydantic hatasinin alani -> satir mesaji
_FIELD_MESSAGES = {
    "email": messages.IMPORT_INVALID_EMAIL,
    "full_name": messages.IMPORT_INVALID_NAME,
    "role": messages.IMPORT_INVALID_ROLE,
    "reporter_kind": messages.IMPORT_INVALID_REPORTER_KIND,
}


def to_user(row: ImportRow, department_id: int | None, password: str) -> UserCreate | str:
    """Satiri UserCreate'e cevirir; gecersizse kullaniciya gosterilecek mesaji doner."""
    fields = row.fields
    try:
        return UserCreate(
            email=fields["email"],
            full_name=fields["full_name"],
            role=fields["role"].upper(),
            reporter_kind=fields.get("reporter_kind", "").upper() or None,
            department_id=department_id,
            password=password,
        )
    except ValidationError as error:
        field = str(error.errors()[0]["loc"][0])
        return _FIELD_MESSAGES.get(field, messages.VALIDATION_ERROR)
