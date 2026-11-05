import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseStatusBadge, PriorityBadge, SlaBadge } from "./TaskBadges";

// Yeni stil (Figma: 08 Yeni Stil (A)): rozetler cerceveli; tonu data-tone ile okunur, metin her zaman yazilir
describe("TaskBadges", () => {
  it("oncelik rozeti tonunu ve adini verir", () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText("Yüksek")).toHaveAttribute("data-tone", "warning");
  });

  it("dusuk oncelik sade rozettir", () => {
    render(<PriorityBadge priority="LOW" />);
    expect(screen.getByText("Düşük")).toHaveAttribute("data-tone", "plain");
  });

  it("kritik oncelik ve yoneticiye iletilen bildirim uyari tonundadir", () => {
    render(
      <>
        <PriorityBadge priority="CRITICAL" />
        <CaseStatusBadge status="ESCALATED" />
      </>,
    );
    expect(screen.getByText("Kritik")).toHaveAttribute("data-tone", "critical");
    expect(screen.getByText("Yöneticiye iletildi")).toHaveAttribute("data-tone", "alert");
  });

  it("durum rozeti yuvarlak hatli, tonu durumdan gelir", () => {
    render(<CaseStatusBadge status="RESOLVED" />);
    expect(screen.getByText("Çözüldü")).toHaveAttribute("data-tone", "solved");
  });

  it("gecikmis hedef sure kirmizi tondadir", () => {
    render(<SlaBadge view={{ status: "BREACHED", label: "26 dk gecikti" }} />);
    expect(screen.getByText("26 dk gecikti")).toHaveAttribute("data-tone", "BREACHED");
  });
});
