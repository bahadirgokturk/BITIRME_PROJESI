"""Onleyici bakim: tekrarlayan sorunun tipik araligindan rutin kontrol sikligi."""

from datetime import UTC, datetime, timedelta

from app.analytics.recurring import routine_plan

START = datetime(2026, 9, 1, 10, 0, tzinfo=UTC)


def _at(*days: float) -> list[datetime]:
    return [START + timedelta(days=d) for d in days]


def test_median_gap_sets_the_routine_before_the_problem_returns() -> None:
    # Araliklar 1, 2, 2, 5, 18 gun: ortanca 2 gun
    plan = routine_plan(_at(0, 5, 23, 25, 27, 28))

    assert plan.median_interval_hours == 48.0
    assert plan.every_days == 2


def test_order_of_reports_does_not_matter() -> None:
    assert routine_plan(_at(28, 0, 25, 5, 27, 23)) == routine_plan(_at(0, 5, 23, 25, 27, 28))


def test_fractional_gap_rounds_the_routine_down() -> None:
    # 3,5 gunde bir tekrarlayan sorun 3 gunde bir kontrol edilir (sorun donmeden once)
    plan = routine_plan(_at(0, 3.5, 7, 10.5))

    assert plan.median_interval_hours == 84.0
    assert plan.every_days == 3


def test_problems_within_a_day_mean_a_daily_routine() -> None:
    plan = routine_plan(_at(0, 0.25, 0.5, 0.75))

    assert plan.every_days == 1


def test_a_single_report_has_no_routine() -> None:
    plan = routine_plan(_at(0))

    assert plan.median_interval_hours is None
    assert plan.every_days is None
