"""Surec madenciligi (RQ4): olay kaydindan dogrudan-takip grafi ve surec varyantlari."""

from datetime import UTC, datetime, timedelta

from app.analytics.process_map import Step, discover
from app.models.enums import CaseEventType as E

START = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)


def _trace(*steps: tuple[E, int]) -> list[Step]:
    return [Step(event, START + timedelta(minutes=minutes)) for event, minutes in steps]


HAPPY = _trace(
    (E.CASE_CREATED, 0),
    (E.TASK_CREATED, 2),
    (E.TASK_ACCEPTED, 22),
    (E.WORK_STARTED, 30),
    (E.WORK_COMPLETED, 60),
    (E.CASE_CLOSED, 62),
)
DECLINED = _trace(
    (E.CASE_CREATED, 0),
    (E.TASK_CREATED, 4),
    (E.TASK_DECLINED, 50),
    (E.TASK_CREATED, 70),
    (E.TASK_ACCEPTED, 90),
    (E.WORK_STARTED, 100),
    (E.WORK_COMPLETED, 130),
    (E.CASE_CLOSED, 140),
)


def test_edges_count_each_handover_with_its_median_wait() -> None:
    found = discover([HAPPY, HAPPY, DECLINED])
    edges = {(e.source, e.target): e for e in found.edges}

    created_to_task = edges[(E.CASE_CREATED, E.TASK_CREATED)]
    assert (created_to_task.count, created_to_task.median_min) == (3, 2.0)
    assert edges[(E.TASK_CREATED, E.TASK_DECLINED)].count == 1
    # Ret sonrasi yeniden gorev: dongu haritada ayri bir ok olarak gorunur
    assert edges[(E.TASK_DECLINED, E.TASK_CREATED)].median_min == 20.0
    assert edges[(E.TASK_CREATED, E.TASK_ACCEPTED)].count == 3


def test_variants_are_the_paths_most_cases_take() -> None:
    found = discover([HAPPY, DECLINED, HAPPY])

    first, second = found.variants
    assert first.steps == [s.event for s in HAPPY]
    assert (first.count, first.share_pct, first.median_total_min) == (2, 66.7, 62.0)
    assert second.count == 1
    assert found.case_count == 3


def test_repeated_events_in_a_row_count_once() -> None:
    # Ayni olay arka arkaya iki kez yazildiysa (or. iki kez gorev olusturma) yol degismez
    doubled = _trace(
        (E.CASE_CREATED, 0), (E.TASK_CREATED, 1), (E.TASK_CREATED, 3), (E.CASE_CLOSED, 9)
    )

    found = discover([doubled])

    assert found.variants[0].steps == [E.CASE_CREATED, E.TASK_CREATED, E.CASE_CLOSED]
    edges = {(e.source, e.target): e.median_min for e in found.edges}
    # Bekleme, adimin ilk goruldugu andan sayilir
    assert edges[(E.TASK_CREATED, E.CASE_CLOSED)] == 8.0


def test_activities_report_how_many_cases_reach_them() -> None:
    found = discover([HAPPY, DECLINED])
    activities = {a.event: a.cases for a in found.activities}

    assert activities[E.CASE_CREATED] == 2
    assert activities[E.TASK_DECLINED] == 1


def test_variant_list_is_capped() -> None:
    traces = [
        _trace((E.CASE_CREATED, 0), (E.TASK_CREATED, minutes), (E.CASE_CLOSED, minutes + 1))
        for minutes in range(1, 4)
    ] + [_trace((E.CASE_CREATED, 0), (event, 1)) for event in (E.CASE_REJECTED, E.INFO_REQUESTED)]

    found = discover(traces, variant_limit=2)

    assert len(found.variants) == 2
    assert found.variants[0].count == 3


def test_no_cases_no_map() -> None:
    found = discover([])

    assert (found.case_count, found.edges, found.variants, found.activities) == (0, [], [], [])


def test_every_map_activity_has_a_turkish_label() -> None:
    from app.analytics.process_map import MAP_ACTIVITIES
    from app.core.messages import PROCESS_ACTIVITY_LABELS

    assert set(PROCESS_ACTIVITY_LABELS) == {event.value for event in MAP_ACTIVITIES}
