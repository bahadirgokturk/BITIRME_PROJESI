from pathlib import Path

import pytest

from scripts.check_ascii_comments import find_violations, main


def _write(tmp_path: Path, name: str, content: str) -> Path:
    path = tmp_path / name
    path.write_text(content, encoding="utf-8")
    return path


def test_python_comment_with_turkish_letter_is_reported(tmp_path: Path) -> None:
    path = _write(tmp_path, "a.py", "x = 1\n# sırayla değerlendir\n")

    violations = find_violations(path)

    assert [v.line for v in violations] == [2]


def test_python_docstring_with_turkish_letter_is_reported(tmp_path: Path) -> None:
    path = _write(tmp_path, "a.py", 'def f() -> None:\n    """Görev oluştur."""\n')

    assert [v.line for v in find_violations(path)] == [2]


def test_python_user_facing_string_is_allowed(tmp_path: Path) -> None:
    path = _write(tmp_path, "a.py", 'NOT_FOUND = "Kayıt bulunamadı."  # kullaniciya donen metin\n')

    assert find_violations(path) == []


def test_ts_line_and_block_comments_are_reported(tmp_path: Path) -> None:
    content = 'const a = "https://x.com"; // görev\n/*\n ok\n çöp\n*/\nconst b = 1;\n'
    path = _write(tmp_path, "a.ts", content)

    assert [v.line for v in find_violations(path)] == [1, 4]


def test_tsx_ui_text_and_strings_are_allowed(tmp_path: Path) -> None:
    content = (
        "export function A() {\n"
        '  const label = "Giriş yap"; // buton etiketi\n'
        "  return <p>{label} — `Kampüs`</p>;\n"
        "}\n"
    )
    path = _write(tmp_path, "A.tsx", content)

    assert find_violations(path) == []


def test_jsx_comment_is_reported(tmp_path: Path) -> None:
    path = _write(tmp_path, "A.tsx", "const x = <div>{/* başlık */}</div>;\n")

    assert [v.line for v in find_violations(path)] == [1]


def test_main_fails_on_violation_and_skips_vendor_dirs(tmp_path: Path) -> None:
    _write(tmp_path, "ok.py", "# temiz yorum\n")
    vendor = tmp_path / "node_modules"
    vendor.mkdir()
    _write(vendor, "lib.js", "// üçüncü parti\n")
    assert main([str(tmp_path)]) == 0

    _write(tmp_path, "bad.py", "# kötü\n")
    assert main([str(tmp_path)]) == 1


def test_unknown_path_fails_fast(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        main([str(tmp_path / "missing")])
