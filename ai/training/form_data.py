"""Gercek veri: Google Form cevaplarini temizler, iki kisinin etiketleyecegi dosyalari hazirlar ve
etiketleri birlestirir (docs/DATA_COLLECTION.md, docs/AGENTS.md 6.2).

Kullanim:
    uv run python -m training.form_data prepare --responses data/raw/form_responses.csv
    uv run python -m training.form_data merge
"""

import argparse
import csv
import random
import re
from dataclasses import dataclass, field
from pathlib import Path

from sklearn.metrics import cohen_kappa_score

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates

# Formdaki soru basliklari = Google Forms CSV basliklari; metin docs/DATA_COLLECTION.md ile ayni
CONSENT_COLUMN = "Aydınlatma metni"
CONSENT_ANSWER = "Okudum, anonim yanıtlarımın bu amaçla kullanılmasını kabul ediyorum."
TEXT_COLUMNS = (
    "Kampüste gördüğün bir sorunu yaz",
    "Aklına gelen başka bir sorun varsa onu da yaz",
)
# Backend CASE_DESCRIPTION_MIN_LENGTH ile ayni: uygulamada daha kisa bildirim gonderilemez
MIN_TEXT_LENGTH = 10

LABELING_DIR = Path("data/raw/labeling")
LABELED_OUT = Path("data/labeled/real.csv")

# Kisisel veri formda istenmez; yine de yazilmissa etiketlemeden once maskelenir (KVKK)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_PHONE = re.compile(r"(\+90[\s-]*)?\b0?5\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b")
# 9 ve uzeri rakam: ogrenci numarasi ya da TC kimlik numarasi olabilir
_LONG_NUMBER = re.compile(r"\b\d{9,}\b")
_SPACES = re.compile(r"\s+")


def mask_personal_data(text: str) -> str:
    text = _EMAIL.sub("[e-posta]", text)
    text = _PHONE.sub("[telefon]", text)
    return _LONG_NUMBER.sub("[numara]", text)


def clean_responses(rows: list[dict[str, str]]) -> list[str]:
    """Onay verenlerin cevaplari; bosluk duzeltilir, kisa ve tekrar eden cumleler atilir."""
    texts: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if row.get(CONSENT_COLUMN, "").strip() != CONSENT_ANSWER:
            continue
        for column in TEXT_COLUMNS:
            text = mask_personal_data(_SPACES.sub(" ", row.get(column, "")).strip())
            key = text.casefold()
            if len(text) >= MIN_TEXT_LENGTH and key not in seen:
                seen.add(key)
                texts.append(text)
    return texts


def labeling_rows(texts: list[str], seed: int) -> list[dict[str, str]]:
    rows = [
        {"id": f"R{index:04d}", "text": text, "label": ""}
        for index, text in enumerate(texts, start=1)
    ]
    # Form sirasi etiketciyi yonlendirmesin: tohumlu karistirma (guvenlik icin degil)
    random.Random(seed).shuffle(rows)  # noqa: S311
    return rows


@dataclass
class MergeResult:
    labeled: list[tuple[str, str]]
    disagreements: list[dict[str, str]]
    kappa: float
    agreement: float
    counts: dict[str, int] = field(default_factory=dict)


def _checked(rows: list[dict[str, str]], valid: set[str]) -> dict[str, dict[str, str]]:
    for row in rows:
        if row["label"] not in valid:
            raise ValueError(
                f"{row['id']}: '{row['label']}' geçerli bir tür kodu değil (docs/DEPARTMENTS.md)"
            )
    return {row["id"]: row for row in rows}


def merge_labels(
    a: list[dict[str, str]],
    b: list[dict[str, str]],
    valid: set[str],
    resolved: list[dict[str, str]] | None = None,
) -> MergeResult:
    """Iki bagimsiz etiketlemeyi birlestirir.

    Uyusan satirlar ve ekipce cozulen anlasmazliklar real.csv'ye girer.
    """
    by_a, by_b = _checked(a, valid), _checked(b, valid)
    if by_a.keys() != by_b.keys():
        raise ValueError("İki etiket dosyası aynı satırları içermeli (aynı id'ler).")
    finals = {row["id"]: row["final"] for row in resolved or [] if row.get("final") in valid}
    ids = sorted(by_a)
    labels_a = [by_a[i]["label"] for i in ids]
    labels_b = [by_b[i]["label"] for i in ids]
    agreed = [i for i in ids if by_a[i]["label"] == by_b[i]["label"]]
    disagreements = [
        {
            "id": i,
            "text": by_a[i]["text"],
            "label_a": by_a[i]["label"],
            "label_b": by_b[i]["label"],
            "final": finals.get(i, ""),
        }
        for i in ids
        if i not in agreed
    ]
    labeled = [
        (by_a[i]["text"], by_a[i]["label"] if i in agreed else finals[i])
        for i in ids
        if i in agreed or i in finals
    ]
    return MergeResult(
        labeled=labeled,
        disagreements=[row for row in disagreements if not row["final"]],
        kappa=round(float(cohen_kappa_score(labels_a, labels_b)), 3)
        if len(set(labels_a + labels_b)) > 1
        else 1.0,
        agreement=round(len(agreed) / len(ids), 3),
        counts={"rows": len(ids), "agreed": len(agreed), "resolved": len(finals)},
    )


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def prepare_files(responses: Path, out_dir: Path, seed: int) -> int:
    """Iki etiketciye ayni satirlarla iki ayri dosya; birbirlerinin etiketini gormezler."""
    rows = labeling_rows(clean_responses(_read(responses)), seed=seed)
    for name in ("labeler_a.csv", "labeler_b.csv"):
        _write(out_dir / name, ["id", "text", "label"], rows)
    return len(rows)


def merge_files(labeling_dir: Path, out: Path) -> MergeResult:
    resolved_path = labeling_dir / "disagreements.csv"
    resolved = _read(resolved_path) if resolved_path.exists() else None
    valid = set(load_templates(CAMPUS_TEMPLATES_PATH))
    result = merge_labels(
        _read(labeling_dir / "labeler_a.csv"),
        _read(labeling_dir / "labeler_b.csv"),
        valid,
        resolved,
    )
    _write(
        out, ["text", "label"], [{"text": text, "label": label} for text, label in result.labeled]
    )
    _write(resolved_path, ["id", "text", "label_a", "label_b", "final"], result.disagreements)
    return result


def summary(result: MergeResult) -> str:
    counts = result.counts
    return (
        f"satır {counts['rows']} | uyuşan {counts['agreed']} | ekipçe çözülen {counts['resolved']}"
        f" | kalan anlaşmazlık {len(result.disagreements)}"
        f" | kappa {result.kappa} | uyum %{round(result.agreement * 100)}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Google Form verisini etiketlemeye hazirla ya da birlestir"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    prepare = sub.add_parser("prepare", help="Form CSV'sinden iki etiketleme dosyasi uret")
    prepare.add_argument("--responses", type=Path, required=True)
    prepare.add_argument("--out", type=Path, default=LABELING_DIR)
    prepare.add_argument("--seed", type=int, default=42)
    merge = sub.add_parser("merge", help="Iki etiketlemeyi birlestir, kappa hesapla, real.csv yaz")
    merge.add_argument("--labeling", type=Path, default=LABELING_DIR)
    merge.add_argument("--out", type=Path, default=LABELED_OUT)
    args = parser.parse_args()
    if args.command == "prepare":
        count = prepare_files(args.responses, args.out, args.seed)
        print(f"{count} cümle etiketlemeye hazır: {args.out}")
        return
    print(summary(merge_files(args.labeling, args.out)))


if __name__ == "__main__":
    main()
