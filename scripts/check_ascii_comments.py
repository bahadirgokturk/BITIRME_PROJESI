"""Kod yorumlari ve docstring'ler yalniz ASCII icerir (KOD_KURALLARI kural 3).

Kullanici metinleri (string'ler, JSX metni) kontrol edilmez; yalniz yorumlar taranir.
Kullanim: python scripts/check_ascii_comments.py backend ai frontend/src scripts
"""

import ast
import io
import sys
import tokenize
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

SKIPPED_DIRS = {"node_modules", ".next", ".venv", "venv", "__pycache__", "dist", "build", "out"}
PYTHON_SUFFIXES = {".py"}
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
QUOTES = {"'", '"', "`"}


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    text: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: yorumda ASCII disi karakter: {self.text.strip()}"


def _is_ascii(text: str) -> bool:
    return text.isascii()


def _python_comments(source: str) -> Iterator[tuple[int, str]]:
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT:
            yield token.start[0], token.string
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        docstring = ast.get_docstring(node, clean=False)
        if docstring is not None:
            first_stmt = node.body[0]
            yield first_stmt.lineno, docstring


def _script_comments(source: str) -> Iterator[tuple[int, str]]:
    # Basit lexer: string/template icindeki "//" yorum sayilmaz. Regex literal'lari desteklenmez.
    i, line, quote = 0, 1, ""
    while i < len(source):
        char, pair = source[i], source[i : i + 2]
        if quote:
            i, line, quote = _advance_in_string(source, i, line, quote)
        elif char in QUOTES:
            quote, i = char, i + 1
        elif pair in ("//", "/*"):
            end = source.find("\n" if pair == "//" else "*/", i)
            end = len(source) if end == -1 else end
            yield from _split_lines(source[i:end], line)
            line += source.count("\n", i, end)
            i = end
        else:
            line += char == "\n"
            i += 1


def _advance_in_string(source: str, i: int, line: int, quote: str) -> tuple[int, int, str]:
    char = source[i]
    if char == "\\":
        return i + 2, line + (source[i + 1 : i + 2] == "\n"), quote
    if char == "\n":
        # Tek/cift tirnakli string satir sonunu gecemez; template literal gecebilir
        return i + 1, line + 1, quote if quote == "`" else ""
    return i + 1, line, "" if char == quote else quote


def _split_lines(comment: str, first_line: int) -> Iterator[tuple[int, str]]:
    for offset, text in enumerate(comment.split("\n")):
        yield first_line + offset, text


def _comment_reader(path: Path) -> Callable[[str], Iterator[tuple[int, str]]] | None:
    if path.suffix in PYTHON_SUFFIXES:
        return _python_comments
    if path.suffix in SCRIPT_SUFFIXES:
        return _script_comments
    return None


def find_violations(path: Path) -> list[Violation]:
    reader = _comment_reader(path)
    if reader is None:
        return []
    source = path.read_text(encoding="utf-8")
    violations: list[Violation] = []
    for line, text in reader(source):
        violations.extend(
            Violation(path, line + offset, part)
            for offset, part in enumerate(text.split("\n"))
            if not _is_ascii(part)
        )
    return violations


def _iter_files(root: Path) -> Iterator[Path]:
    if not root.exists():
        raise FileNotFoundError(root)
    if root.is_file():
        yield root
        return
    for path in sorted(root.rglob("*")):
        if path.is_file() and not SKIPPED_DIRS.intersection(path.relative_to(root).parts):
            yield path


def main(argv: list[str]) -> int:
    violations = [
        v for arg in argv for path in _iter_files(Path(arg)) for v in find_violations(path)
    ]
    for violation in violations:
        print(violation)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
