"""CSV ayristirma: Excel'in kaydettigi bicimler (noktali virgul, BOM, Windows-1254) okunur."""

import pytest

from app.core.errors import InvalidImportFileError
from app.services.user_import import IMPORT_MAX_ROWS, decode, parse

HEADER = "email,full_name,role,reporter_kind,department_code"


def test_comma_file_with_bom_is_read() -> None:
    data = f"﻿{HEADER}\nali@x.edu.tr,Ali Veli,REPORTER,STUDENT,\n".encode()

    rows = parse(decode(data))

    assert [(r.row, r.fields["email"], r.fields["full_name"]) for r in rows] == [
        (2, "ali@x.edu.tr", "Ali Veli")
    ]


def test_turkish_excel_semicolon_and_windows_1254_is_read() -> None:
    text = "E-posta;Ad Soyad;Rol\nayse@x.edu.tr;Ayşe Işık;STAFF\n"
    data = (
        text.replace("E-posta", "email")
        .replace("Ad Soyad", "full_name")
        .replace("Rol", "role")
        .encode("cp1254")
    )

    [row] = parse(decode(data))

    assert row.fields["full_name"] == "Ayşe Işık"
    assert row.fields["role"] == "STAFF"


def test_headers_are_case_and_space_insensitive_and_blank_lines_skipped() -> None:
    text = " Email , FULL_NAME ,Role\n\nali@x.edu.tr, Ali ,admin\n"

    [row] = parse(text)

    assert row.row == 3
    assert row.fields == {"email": "ali@x.edu.tr", "full_name": "Ali", "role": "admin"}


def test_missing_required_column_is_refused() -> None:
    with pytest.raises(InvalidImportFileError, match="role"):
        parse("email,full_name\nali@x.edu.tr,Ali\n")


def test_empty_file_is_refused() -> None:
    with pytest.raises(InvalidImportFileError):
        parse(f"{HEADER}\n")


def test_too_many_rows_is_refused() -> None:
    body = "".join(f"u{i}@x.edu.tr,U,REPORTER\n" for i in range(IMPORT_MAX_ROWS + 1))

    with pytest.raises(InvalidImportFileError):
        parse("email,full_name,role\n" + body)
