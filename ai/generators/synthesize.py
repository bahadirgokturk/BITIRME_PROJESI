"""Sentetik bildirim uretici (E5-3, docs/AGENTS.md bolum 6).

Her case type icin sablon cumle x lokasyon ifadesi x gurultu (gunluk ifade, kucuk harf, harf hatasi).
Lokasyonlar backend kampus seed'inden okunur: modelin gordugu yerler uygulamadakilerle ayni olsun.
Uretim tohumla (seed) tekrarlanabilir; her ornek sablon kimligini tasir (sablon bazli test ayrimi).

Kullanim: uv run python -m generators.synthesize --per-type 160 --seed 42 --out data/synthetic/campus.csv
"""

import argparse
import csv
import random
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates

CAMPUS_LOCATIONS_PATH = (
    Path(__file__).resolve().parents[2] / "backend" / "seeds" / "templates" / "campus" / "locations.yaml"
)
# Kampus kokunun adi ("Merkez Kampus") bildirimde yer olarak kullanilmaz. OTHER turundeki yerler
# ekipman adi tasir ("Asansor", "Turnikeler"): baska turdeki cumleye girince etiketi bulandirir
_EXCLUDED_KINDS = frozenset({"CAMPUS", "OTHER"})
# Python'un lower()'i Turkce I/I(noktali) harflerini yanlis cevirir
_TURKISH_UPPER = str.maketrans({"I": "ı", "İ": "i"})

# Gurultu olasiliklari: gercek bildirimler cogu zaman kucuk harf, kisa ve ozensiz yazilir
LOWERCASE_PROBABILITY = 0.5
TYPO_PROBABILITY = 0.2
FILLER_PROBABILITY = 0.3
# Harf hatasi yalniz bu uzunluktaki kelimelere: kisa kelimede ("wc") anlam tamamen kaybolur
TYPO_MIN_WORD_LENGTH = 5
# Benzersiz ornek bulunamazsa sonsuz donguye girmemek icin tur basina deneme ust siniri
MAX_ATTEMPTS_PER_SAMPLE = 50

PREFIXES = ("", "merhaba", "hocam", "arkadaşlar", "acil", "rica etsem")
SUFFIXES = ("", "lütfen", "ilgilenir misiniz", "teşekkürler", "yine", "!!", "acil bakılsın")


class GenerationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Sample:
    text: str
    label: str
    # "<CASE_TYPE>#<sablon sirasi>"
    template_id: str


def _walk(nodes: list[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    for node in nodes:
        yield node
        yield from _walk(node.get("children", []))


def load_location_phrases(path: Path) -> list[str]:
    """Lokasyon adlari ve takma adlari (tekrarsiz, sirali)."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    phrases: set[str] = set()
    for node in _walk(data["locations"]):
        if node["kind"] in _EXCLUDED_KINDS:
            continue
        phrases.add(node["name"])
        phrases.update(node.get("aliases", []))
    return sorted(phrases)


def turkish_lower(text: str) -> str:
    return text.translate(_TURKISH_UPPER).lower()


def add_typo(text: str, rng: random.Random) -> str:
    """Uzun bir kelimede yan yana iki harfin yerini degistirir ("projeksiyon" -> "porjeksiyon")."""
    words = text.split()
    candidates = [i for i, word in enumerate(words) if len(word) >= TYPO_MIN_WORD_LENGTH]
    if not candidates:
        return text
    index = rng.choice(candidates)
    word = words[index]
    # Ayni iki harfin yer degistirmesi metni degistirmez; farkli komsu cifti secilir
    pairs = [i for i in range(len(word) - 1) if word[i] != word[i + 1]]
    if not pairs:
        return text
    i = rng.choice(pairs)
    words[index] = word[:i] + word[i + 1] + word[i] + word[i + 2 :]
    return " ".join(words)


def _noisy(sentence: str, rng: random.Random) -> str:
    text = sentence
    if rng.random() < FILLER_PROBABILITY:
        text = " ".join(part for part in (rng.choice(PREFIXES), sentence, rng.choice(SUFFIXES)) if part)
    if rng.random() < LOWERCASE_PROBABILITY:
        text = turkish_lower(text)
    if rng.random() < TYPO_PROBABILITY:
        text = add_typo(text, rng)
    return text


@dataclass
class _Generator:
    locations: list[str]
    per_type: int
    rng: random.Random

    def samples_for(self, code: str, sentences: list[str]) -> list[Sample]:
        seen: dict[str, Sample] = {}
        for _ in range(self.per_type * MAX_ATTEMPTS_PER_SAMPLE):
            if len(seen) == self.per_type:
                break
            index = self.rng.randrange(len(sentences))
            sentence = sentences[index].format(location=self.rng.choice(self.locations))
            text = _noisy(sentence, self.rng)
            seen.setdefault(text, Sample(text=text, label=code, template_id=f"{code}#{index}"))
        if len(seen) < self.per_type:
            raise GenerationError(f"{code}: {self.per_type} benzersiz ornek uretilemedi ({len(seen)})")
        return list(seen.values())


def generate(
    templates: dict[str, list[str]], locations: list[str], *, per_type: int, seed: int
) -> list[Sample]:
    generator = _Generator(locations=locations, per_type=per_type, rng=random.Random(seed))
    samples: list[Sample] = []
    for code in sorted(templates):
        samples.extend(generator.samples_for(code, templates[code]))
    return samples


def write_csv(samples: list[Sample], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label", "template_id"])
        writer.writerows((s.text, s.label, s.template_id) for s in samples)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sentetik kampus bildirimi uret")
    parser.add_argument("--per-type", type=int, default=160)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path("data/synthetic/campus.csv"))
    args = parser.parse_args()
    templates = load_templates(CAMPUS_TEMPLATES_PATH)
    samples = generate(
        templates, load_location_phrases(CAMPUS_LOCATIONS_PATH), per_type=args.per_type, seed=args.seed
    )
    write_csv(samples, args.out)
    print(f"{len(samples)} ornek -> {args.out}")


if __name__ == "__main__":
    main()
