import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrintButton, PrintMeta } from "./PrintButton";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrintButton", () => {
  it("opens the browser's print dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<PrintButton />);

    await user.click(screen.getByRole("button", { name: "Yazdır" }));

    expect(print).toHaveBeenCalledOnce();
  });
});

describe("PrintMeta", () => {
  it("writes the period and the print date for the paper copy only", () => {
    render(<PrintMeta period="7d" now={new Date("2026-10-23T11:40:00Z")} />);

    const line = screen.getByText(/Son 7 gün · BakırçayFlow · Yazdırıldı:/);
    expect(line).toHaveTextContent("23 Eki 2026");
    expect(line).toHaveClass("hidden", "print:block");
  });
});
