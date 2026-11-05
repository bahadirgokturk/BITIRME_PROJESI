"""Duplicate Agent (AGENTS.md 4.3): ayni sorunu bildiren yeni bildirimi mevcut bildirime baglar.

Skor = 0.45 metin + 0.25 tur + 0.20 konum + 0.10 zaman. Adaylari servis verir; agent DB'ye dokunmaz.
"""

import math
from datetime import UTC, datetime, timedelta

import pytest

from app.agents.base import AgentContext
from app.agents.duplicate import (
    DUPLICATE_MODEL,
    DuplicateAgent,
    DuplicateCandidate,
    DuplicateDecision,
    DuplicateInput,
)

NOW = datetime(2026, 10, 7, 7, 0, tzinfo=UTC)
CTX = AgentContext(now=NOW)
WC = "KMP/A/A-1/A-1-WCE"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"


def _candidate(case_id: int = 1, **changes: object) -> DuplicateCandidate:
    base = DuplicateCandidate(
        case_id=case_id,
        text=SOAP,
        case_type_code="SOAP_EMPTY",
        location_id=10,
        location_path=WC,
        created_at=NOW,
        duplicate_count=0,
    )
    return base.model_copy(update=changes)


def _run(candidates: list[DuplicateCandidate], **changes: object) -> object:
    inp = DuplicateInput(
        text=SOAP,
        case_type_code="SOAP_EMPTY",
        location_id=10,
        location_path=WC,
        reported_at=NOW,
        candidates=candidates,
    )
    return DuplicateAgent().run(inp.model_copy(update=changes), CTX)


def test_without_candidates_it_is_a_new_case() -> None:
    result = _run([])

    assert result.decision == DuplicateDecision.NEW_CASE
    assert result.output.duplicate_probability == 0
    assert result.output.possible_parent_case_id is None
    assert result.output.duplicate_count == 0
    assert result.reasons[0].code == "NO_SIMILAR_CASE"
    assert result.model == DUPLICATE_MODEL


def test_same_problem_same_place_just_reported_is_a_duplicate() -> None:
    result = _run([_candidate(case_id=7)])

    assert result.decision == DuplicateDecision.DUPLICATE
    assert result.output.duplicate_probability == 1.0
    assert result.output.possible_parent_case_id == 7
    assert result.reasons[0].code == "DUPLICATE_OF"
    assert result.reasons[0].evidence["case_id"] == 7


def test_score_is_the_weighted_sum_of_the_components() -> None:
    # Ayni metin ve yer, farkli tur: 0.45 + 0 + 0.20 + 0.10
    result = _run([_candidate(case_type_code="TRASH_FULL")])

    similar = result.output.similar_cases[0]
    assert similar.components == {
        "text": 1.0,
        "type": 0.0,
        "location": 1.0,
        "time": 1.0,
        "same_spot": 0.0,
    }
    assert similar.score == pytest.approx(0.75)


@pytest.mark.parametrize(
    ("location_id", "path", "expected"),
    [
        (11, "KMP/A/A-1/A-1-WCK", 0.6),  # ayni kat, karsi WC
        (12, "KMP/A/A-Z/A-Z-WCE", 0.3),  # ayni bina, baska kat
        (13, "KMP/B/B-Z/B-Z-WC", 0.0),  # baska bina
    ],
)
def test_location_score_by_distance(location_id: int, path: str, expected: float) -> None:
    # Yayilan sorun: farkli yerlerden ayni ariza bildirilebilir
    wifi = {"case_type_code": "WIFI_FAILURE"}
    result = _run([_candidate(location_id=location_id, location_path=path, **wifi)], **wifi)

    assert result.output.similar_cases[0].components["location"] == expected


@pytest.mark.parametrize(
    ("case_type", "tau_minutes"),
    [("SOAP_EMPTY", 120), ("WATER_LEAK", 60)],
)
def test_time_decays_with_a_case_type_specific_tau(case_type: str, tau_minutes: int) -> None:
    an_hour_ago = NOW - timedelta(minutes=60)
    result = _run(
        [_candidate(case_type_code=case_type, created_at=an_hour_ago)], case_type_code=case_type
    )

    expected = round(math.exp(-60 / tau_minutes), 3)
    assert result.output.similar_cases[0].components["time"] == expected


def test_turkish_spelling_differences_do_not_matter() -> None:
    result = _run([_candidate(text="WC'DE SABUN YOK")], text="wc de sabun yok")

    assert result.output.similar_cases[0].components["text"] == 1.0


def test_same_problem_reported_from_a_nearby_room_goes_to_review() -> None:
    # Yayilan sorun baska odadan: ayni ariza olabilir, karari manager verir
    wifi = {"case_type_code": "WIFI_FAILURE"}
    nearby = _candidate(text="Wifi yok", location_id=11, location_path="KMP/A/A-1/A-1-WCK", **wifi)

    result = _run([nearby], text="İnternet yok, wifi bağlanmıyor", **wifi)

    assert result.decision == DuplicateDecision.POSSIBLE_DUPLICATE
    assert 0.6 <= result.output.duplicate_probability < 0.8
    assert result.output.possible_parent_case_id == 1
    assert result.reasons[0].code == "POSSIBLE_DUPLICATE"


def test_short_report_of_the_same_problem_is_merged() -> None:
    result = _run([_candidate(text="Sabun bitmiş")])

    assert result.decision == DuplicateDecision.DUPLICATE


@pytest.mark.parametrize(
    "short",
    ["Sabun bitmiş", "sabun bitmis", "Kadınlar tuvaletinde sabun bitmiş"],
)
def test_a_short_report_contained_in_a_long_one_at_the_same_place_is_merged(short: str) -> None:
    # Uctan uca denemede bulundu: uzun ilk bildirimin yaninda kisa ikinci bildirimin kosinus
    # benzerligi dusuk kaliyor, ayni sorun manager'a gidiyordu
    long_first = _candidate(text="Kadınlar tuvaletinde sabun bitmiş, sabunluklar bomboş")

    result = _run([long_first], text=short)

    assert result.decision == DuplicateDecision.DUPLICATE


def test_containment_does_not_merge_a_spreading_problem_elsewhere() -> None:
    wifi = {"case_type_code": "WIFI_FAILURE"}
    other_room = _candidate(
        text="Kütüphanede wifi yok, hiçbir cihaz bağlanmıyor",
        location_id=12,
        location_path="KMP/A/A-Z/A-Z-WCE",
        **wifi,
    )

    result = _run([other_room], text="wifi yok", **wifi)

    # Baska odadan ayni ariza olabilir ama otomatik birlesmez: manager karar verir
    assert result.decision != DuplicateDecision.DUPLICATE


@pytest.mark.parametrize(
    "text", ["Burada sabun kalmamış", "Erkek tuvaletinde sabun yok", "sabunluk"]
)
def test_any_wording_of_an_open_spot_problem_at_the_same_place_is_merged(text: str) -> None:
    # Uctan uca denemede bulundu: ayni tuvalette ucuncu kisi farkli kelimelerle yazinca manager'a
    # gidiyordu. Ayni noktada ayni turde acik bildirim varsa sorun aynidir (sabunluk ya bos ya dolu)
    result = _run([_candidate()], text=text)

    assert result.decision == DuplicateDecision.DUPLICATE
    assert result.output.similar_cases[0].components["same_spot"] == 1.0


def test_a_short_report_of_a_broad_problem_in_the_same_room_is_merged() -> None:
    # Genis turde ayni oda: kisa metin uzun metnin icinde geciyorsa ayni sorun (kapsama)
    wifi = {"case_type_code": "WIFI_FAILURE"}
    first = _candidate(text="Kütüphanede wifi yok, hiçbir cihaz bağlanmıyor", **wifi)

    result = _run([first], text="wifi yok", **wifi)

    assert result.decision == DuplicateDecision.DUPLICATE
    assert result.output.similar_cases[0].components["same_spot"] == 0.0


def test_different_broad_problems_in_the_same_place_are_not_merged_by_type_alone() -> None:
    # Yemekhanede "yemek soguk" ile "kasada kuyruk" ayni turde ama ayri sorunlar
    cafeteria = {"case_type_code": "CAFETERIA_ISSUE"}
    first = _candidate(text="Yemekler soğuk geliyor", **cafeteria)

    result = _run([first], text="Kasada çok uzun kuyruk var", **cafeteria)

    assert result.decision != DuplicateDecision.DUPLICATE


def test_another_problem_at_the_same_place_is_a_new_case() -> None:
    other = _candidate(text="Tuvalette çöp kutusu dolmuş", case_type_code="TRASH_FULL")

    result = _run([other])

    assert result.decision == DuplicateDecision.NEW_CASE
    assert result.output.duplicate_probability < 0.6
    assert result.output.possible_parent_case_id is None


def test_best_match_wins_and_at_most_three_similar_cases_are_reported() -> None:
    wifi = "WIFI_FAILURE"
    candidates = [
        _candidate(
            case_id=1, location_id=13, location_path="KMP/B/B-Z/B-Z-WC", case_type_code=wifi
        ),
        _candidate(case_id=2, case_type_code=wifi),
        _candidate(
            case_id=3, location_id=12, location_path="KMP/A/A-Z/A-Z-WCE", case_type_code=wifi
        ),
        _candidate(case_id=4, case_type_code="TRASH_FULL"),
    ]

    result = _run(candidates, case_type_code=wifi)

    assert result.output.possible_parent_case_id == 2
    assert [s.case_id for s in result.output.similar_cases] == [2, 3, 1]


def test_duplicate_count_includes_reports_already_merged_into_similar_cases() -> None:
    candidates = [
        _candidate(case_id=1, duplicate_count=3),
        _candidate(case_id=2, text="Sabunluk boş"),
        # Benzer degil: sayilmaz
        _candidate(case_id=3, text="Klima çalışmıyor", case_type_code="AIR_CONDITIONER_FAILURE"),
    ]

    result = _run(candidates)

    # 1 numara + ona baglanmis 3 bildirim + 2 numara
    assert result.output.duplicate_count == 5


@pytest.mark.parametrize(
    ("location_id", "path"),
    [(11, "KMP/A/A-1/A-1-WCK"), (12, "KMP/A/A-Z/A-Z-WCE")],
    ids=["same-floor", "same-building"],
)
def test_a_spot_problem_elsewhere_is_another_problem(location_id: int, path: str) -> None:
    # Uctan uca denemede bulundu: baska kattaki sabunluk "olasi tekrar" sayiliyordu; ayni metinle
    # birlestirilebilirdi. Sabun, kagit, cop gibi sorunlar yalniz ayni yerde ayni sorundur
    elsewhere = _candidate(text=SOAP, location_id=location_id, location_path=path)

    result = _run([elsewhere])

    assert result.decision == DuplicateDecision.NEW_CASE
    assert result.output.similar_cases == []
    assert result.output.duplicate_count == 0


@pytest.mark.parametrize(
    "case_type", ["WIFI_FAILURE", "ELECTRICAL_FAILURE", "WATER_LEAK", "ELEVATOR_FAILURE"]
)
def test_a_spreading_problem_can_be_reported_from_elsewhere(case_type: str) -> None:
    upstairs = _candidate(
        case_type_code=case_type, location_id=11, location_path="KMP/A/A-1/A-1-WCK"
    )

    result = _run([upstairs], case_type_code=case_type)

    assert result.output.possible_parent_case_id == 1


def test_empty_text_has_no_text_similarity() -> None:
    result = _run([_candidate()], text="!!!")

    assert result.output.similar_cases[0].components["text"] == 0.0


def test_candidates_opened_after_the_report_are_ignored() -> None:
    """Ayni yer + ayni tur kurali bile gelecekteki bildirime baglamaz (gecmis veri yukleme)."""
    later = _candidate(created_at=NOW + timedelta(days=10))

    result = _run([later])

    assert result.decision == DuplicateDecision.NEW_CASE
    assert result.output.possible_parent_case_id is None
    assert result.output.similar_cases == []
