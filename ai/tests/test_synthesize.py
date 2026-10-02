import random
from collections import Counter

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates
from generators.synthesize import (
    CAMPUS_LOCATIONS_PATH,
    add_typo,
    generate,
    load_location_phrases,
    turkish_lower,
)

TEMPLATES = load_templates(CAMPUS_TEMPLATES_PATH)
LOCATIONS = load_location_phrases(CAMPUS_LOCATIONS_PATH)
PER_TYPE = 30


def test_location_phrases_come_from_the_campus_seed_with_aliases() -> None:
    # Ayni kampus agaci backend seed'inde; lokasyon adlari ve takma adlari tek kaynaktan gelir
    assert "A Blok Zemin Kat Erkek WC" in LOCATIONS
    assert "a101" in LOCATIONS
    assert "Merkez Kampüs" not in LOCATIONS  # kampus kokunun adi bildirimde yer olarak gecmez


def test_equipment_locations_are_left_out() -> None:
    # "asansor" ya da "turnike" yer olarak baska turdeki cumleye girerse etiketi bulandirir
    # ("asansor projektor calismiyor" asansor arizasi gibi okunur)
    assert not {"asansör", "B Blok Asansör", "turnike", "A Blok Giriş Turnikeleri"} & set(LOCATIONS)


def test_every_case_type_gets_the_requested_number_of_unique_samples() -> None:
    samples = generate(TEMPLATES, LOCATIONS, per_type=PER_TYPE, seed=1)

    counts = Counter(sample.label for sample in samples)
    assert set(counts) == set(TEMPLATES)
    assert set(counts.values()) == {PER_TYPE}
    assert len({sample.text for sample in samples}) == len(samples)


def test_generation_is_reproducible_with_the_same_seed() -> None:
    first = generate(TEMPLATES, LOCATIONS, per_type=5, seed=7)
    again = generate(TEMPLATES, LOCATIONS, per_type=5, seed=7)
    other = generate(TEMPLATES, LOCATIONS, per_type=5, seed=8)

    assert first == again
    assert first != other


def test_placeholders_are_filled_and_samples_remember_their_template() -> None:
    samples = generate(TEMPLATES, LOCATIONS, per_type=PER_TYPE, seed=3)

    for sample in samples:
        assert "{" not in sample.text
        # Sablon kimligi sablon bazli ayrim icin gerekli (ayni cumle iki tarafa dusmesin)
        code, index = sample.template_id.split("#")
        assert code == sample.label
        assert 0 <= int(index) < len(TEMPLATES[code])


def test_typo_swaps_two_neighbouring_letters_of_a_long_word() -> None:
    text = "projeksiyon çalışmıyor"

    noisy = add_typo(text, random.Random(0))

    assert noisy != text
    assert sorted(noisy) == sorted(text)
    assert len(noisy.split()) == len(text.split())


def test_typo_leaves_short_text_alone() -> None:
    assert add_typo("wc yok", random.Random(0)) == "wc yok"


def test_lowercase_follows_turkish_rules() -> None:
    # Python'un lower()'i "I"yi "i", "I(noktali)"yi "i + birlestirici nokta" yapar
    assert turkish_lower("B Blok İdari IŞIK") == "b blok idari ışık"


def test_generated_text_has_no_combining_dot() -> None:
    samples = generate(TEMPLATES, LOCATIONS, per_type=PER_TYPE, seed=5)

    assert not any("̇" in sample.text for sample in samples)
