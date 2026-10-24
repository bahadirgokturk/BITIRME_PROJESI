"""Ogrenen model (v2): mudurun tur duzeltmelerini egitim CSV'sine yazar (stdout).

Kullanim (repo kokunden; dosya ai/data/raw altina, acik repoya girmez):
    docker compose exec -T backend python -m scripts.export_feedback > ai/data/raw/feedback.csv

Sonra ai/ icinde: uv run python -m training.train_classifier --feedback data/raw/feedback.csv ...
"""

import csv
import sys
from typing import TextIO

from sqlalchemy.orm import Session

from app.core.database import get_session_factory
from app.repositories.decision_feedback_repository import type_corrections

COLUMNS = ["text", "label", "case_number", "corrected_at"]


def export(session: Session, out: TextIO) -> int:
    corrections = type_corrections(session)
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(COLUMNS)
    for item in corrections:
        writer.writerow(
            [item.text, item.corrected_type, item.case_number, item.corrected_at.isoformat()]
        )
    return len(corrections)


def main() -> None:
    with get_session_factory()() as session:
        count = export(session, sys.stdout)
    print(f"{count} duzeltme yazildi", file=sys.stderr)


if __name__ == "__main__":
    main()
