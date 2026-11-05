import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { saveXlsx } from "@/lib/exportFile";
import { createQueryClient } from "@/lib/queryClient";
import type { Sheet } from "@/lib/xlsx";

import { ExportButton } from "./ExportButton";

vi.mock("@/lib/exportFile", async (original) => ({
  ...(await original<typeof import("@/lib/exportFile")>()),
  saveXlsx: vi.fn(),
}));

const SHEET: Sheet = { name: "Birimler", columns: ["Birim"], rows: [["Destek"]] };

function renderButton(load: () => Sheet | Promise<Sheet>, disabled = false) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ExportButton fileName="birimler" load={load} disabled={disabled} />
    </QueryClientProvider>,
  );
  return user;
}

beforeEach(() => vi.mocked(saveXlsx).mockClear());

describe("ExportButton", () => {
  it("saves the sheet as a dated xlsx file", async () => {
    const user = renderButton(() => SHEET);

    await user.click(screen.getByRole("button", { name: "Excel'e aktar" }));

    expect(saveXlsx).toHaveBeenCalledWith(SHEET, expect.stringMatching(/^birimler-\d{4}-\d{2}-\d{2}\.xlsx$/));
  });

  it("says it is preparing while the rows load", async () => {
    let finish: (sheet: Sheet) => void = () => undefined;
    const user = renderButton(() => new Promise<Sheet>((resolve) => (finish = resolve)));

    await user.click(screen.getByRole("button", { name: "Excel'e aktar" }));

    expect(screen.getByRole("button", { name: "Hazırlanıyor…" })).toBeDisabled();
    finish(SHEET);
    expect(await screen.findByRole("button", { name: "Excel'e aktar" })).toBeEnabled();
  });

  it("explains a failed export and lets the user try again", async () => {
    const failure = new ApiError(503, "SERVICE_UNAVAILABLE", "Sunucu şu an yanıt vermiyor.", null);
    const user = renderButton(() => Promise.reject(failure));

    await user.click(screen.getByRole("button", { name: "Excel'e aktar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sunucu şu an yanıt vermiyor.");
    expect(saveXlsx).not.toHaveBeenCalled();
  });

  it("is disabled until the list has loaded", () => {
    renderButton(() => SHEET, true);

    expect(screen.getByRole("button", { name: "Excel'e aktar" })).toBeDisabled();
  });
});
