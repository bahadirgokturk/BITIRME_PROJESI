"""Intake Agent (AGENTS.md 4.1): normalizasyon, lokasyon/aciliyet ipuclari, lokasyon tutarliligi."""

from datetime import UTC, datetime

from app.agents.base import AgentContext
from app.agents.intake import IntakeAgent, IntakeInput, LocationInfo

CTX = AgentContext(now=datetime(2026, 9, 29, 10, 0, tzinfo=UTC))
B_WC = LocationInfo(name="B Blok 2. Kat Erkek WC", path="KMP/B/B-2/B-2-WCM")
A_AMFI = LocationInfo(name="A-101 Amfi", path="KMP/A/A-1/A-101")


def _run(description: str, location: LocationInfo = B_WC, title: str = "") -> object:
    return IntakeAgent().run(
        IntakeInput(title=title, description=description, location=location, has_photo=False), CTX
    )


def test_result_follows_the_shared_contract() -> None:
    result = IntakeAgent().run(
        IntakeInput(title="", description="Sabunluk boş", location=B_WC, has_photo=True), CTX
    )

    assert result.agent_name == "intake"
    assert result.model == "rules@1.0"
    assert result.output.normalized_text == "sabunluk bos"
    assert result.latency_ms >= 0


def test_urgency_words_are_found_in_any_spelling() -> None:
    result = IntakeAgent().run(
        IntakeInput(
            title="",
            description="Prizden KIVILCIM çıkıyor, yanık kokusu var",
            location=B_WC,
            has_photo=False,
        ),
        CTX,
    )

    assert set(result.output.urgency_hints) == {"kivilcim", "yanik kokusu"}
    assert "URGENCY_TERMS" in {r.code for r in result.reasons}


def test_matching_building_is_consistent() -> None:
    result = IntakeAgent().run(
        IntakeInput(
            title="",
            description="B blok 2. kat tuvalette sabun yok",
            location=B_WC,
            has_photo=False,
        ),
        CTX,
    )

    assert result.output.location_hints == ["b blok", "2. kat"]
    assert result.output.location_consistency is True


def test_other_building_in_text_is_flagged() -> None:
    # Secilen yer B blok ama metin A blok diyor: Verification icin sinyal
    result = IntakeAgent().run(
        IntakeInput(
            title="", description="A blok tuvaletinde su akiyor", location=B_WC, has_photo=False
        ),
        CTX,
    )

    assert result.output.location_consistency is False
    assert "LOCATION_MISMATCH" in {r.code for r in result.reasons}


def test_room_code_in_text_is_checked() -> None:
    result = IntakeAgent().run(
        IntakeInput(
            title="", description="a101 amfide projeksiyon yok", location=A_AMFI, has_photo=False
        ),
        CTX,
    )

    assert result.output.location_consistency is True


def test_no_location_words_means_unknown_consistency() -> None:
    result = IntakeAgent().run(
        IntakeInput(title="", description="sabun bitmis", location=B_WC, has_photo=False), CTX
    )

    assert result.output.location_consistency is None


def test_title_is_part_of_the_text() -> None:
    result = IntakeAgent().run(
        IntakeInput(
            title="YANGIN", description="koridorda duman var", location=B_WC, has_photo=False
        ),
        CTX,
    )

    assert {"yangin", "duman"} <= set(result.output.urgency_hints)


def test_meaningless_text_is_marked() -> None:
    result = IntakeAgent().run(
        IntakeInput(title="", description="asdf ... !!!", location=B_WC, has_photo=False), CTX
    )

    assert result.output.is_meaningful is False
    assert result.decision == "TOO_SHORT"
