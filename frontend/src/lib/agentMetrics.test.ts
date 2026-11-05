import { describe, expect, it } from "vitest";

import { AGENT_METRICS_EMPTY, AGENT_METRICS_WEEK } from "@/mocks/reportFixtures";

import { agentKpis, agentRows, mostCorrectedHeadline } from "./agentMetrics";

describe("agentKpis", () => {
  it("builds the four cards with a plain explanation each", () => {
    const cards = agentKpis(AGENT_METRICS_WEEK);

    expect(cards.map((card) => [card.label, card.value])).toEqual([
      ["Otomasyon Oranı", "%78"],
      ["Müdür İncelemesi Oranı", "%14"],
      ["Doğru Tür Tahmini", "%92"],
      ["Doğru Tekrar Tespiti", "%88"],
    ]);
    expect(cards[0]?.hint).toBe("Kimse dokunmadan doğru personele atanan bildirimler");
  });

  it("shows a dash when there is no data", () => {
    expect(agentKpis(AGENT_METRICS_EMPTY).map((card) => card.value)).toEqual(["–", "–", "–", "–"]);
  });
});

describe("agentRows", () => {
  it("writes confidence as a percentage", () => {
    expect(agentRows(AGENT_METRICS_WEEK.agents)[0]).toEqual({
      key: "classification",
      name: "Tür belirleme",
      decisions: "64",
      confidence: "%89",
      overrideRate: "%6",
    });
  });

  it("shows a dash for a step without confidence or corrections", () => {
    const row = agentRows([{ agent: "sla", label: "Süre takibi", decisions: 3, avg_confidence: null, override_rate_pct: null }])[0];

    expect(row).toMatchObject({ confidence: "–", overrideRate: "–" });
  });
});

describe("mostCorrectedHeadline", () => {
  it("names the step the manager corrects most", () => {
    expect(mostCorrectedHeadline(AGENT_METRICS_WEEK.agents)).toBe("En çok düzeltilen adım: Birime yönlendirme (%9)");
  });

  it("falls back to a plain title without corrections", () => {
    expect(mostCorrectedHeadline([])).toBe("Yapay zekâ adımları");
    expect(
      mostCorrectedHeadline([{ agent: "a", label: "Tür belirleme", decisions: 5, avg_confidence: 0.9, override_rate_pct: 0 }]),
    ).toBe("Yapay zekâ adımları");
  });
});
