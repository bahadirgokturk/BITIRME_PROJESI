import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { saveXlsx } from "@/lib/exportFile";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminAgentPolicies } from "@/mocks/adminAgentPolicyHandlers";
import { resetAdminCaseTypes } from "@/mocks/adminCaseTypeHandlers";
import { server } from "@/mocks/node";

import { AgentPoliciesScreen } from "./AgentPoliciesScreen";

type User = ReturnType<typeof userEvent.setup>;

vi.mock("@/lib/exportFile", async (original) => ({
  ...(await original<typeof import("@/lib/exportFile")>()),
  saveXlsx: vi.fn(),
}));

// Son "Excel'e aktar" ile kaydedilen tablo ve dosya adi
async function exportSheet(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(saveXlsx).mockClear();
  await user.click(await screen.findByRole("button", { name: "Excel'e aktar" }));
  await waitFor(() => expect(saveXlsx).toHaveBeenCalled());
  const [sheet, fileName] = vi.mocked(saveXlsx).mock.calls[0] ?? [];
  return { sheet: sheet!, fileName: fileName! };
}

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AgentPoliciesScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

async function openEdit(user: User, name: string) {
  await user.click(await screen.findByRole("button", { name: `${name} politikasını düzenle` }));
  return screen.findByRole("dialog", { name: "Politikayı düzenle" });
}

function errorResponse(status: number, message: string) {
  return HttpResponse.json({ error: { code: "INTERNAL_ERROR", message, details: {} } }, { status });
}

// Sahte listeler modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => {
  resetAdminAgentPolicies();
  resetAdminCaseTypes();
});

describe("AgentPoliciesScreen", () => {
  it("shows a skeleton while policies load", () => {
    renderScreen();

    expect(screen.getByLabelText("Yapay zekâ politikaları yükleniyor")).toBeInTheDocument();
  });

  it("lists one policy per type in plain words, without an add button", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("ELECTRICAL_FAILURE")).toBeInTheDocument();
    expect(within(power).getByText("Müdür karar verir")).toBeInTheDocument();
    expect(within(power).getByText("%70")).toBeInTheDocument();
    expect(within(await row(/Sabun bitti/)).getByText("Kendi uygular")).toBeInTheDocument();
    expect(screen.getByText("6 politika").closest("[data-slot=admin-table]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /ekle/i })).not.toBeInTheDocument();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("Müdür karar verir").closest("td")).toHaveAttribute("data-label", "Karar yetkisi");
    expect(within(power).getByText("%70").closest("td")).toHaveAttribute("data-label", "Güven eşiği");
  });

  // Mudure birakan seviye amber, kendi uygulayan yesil rozet (Figma: 08 Yeni Stil (A) > Yapay Zeka Politikalari)
  it("shows the autonomy level as a toned badge", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("Müdür karar verir")).toHaveAttribute("data-tone", "warning");
    expect(within(await row(/Sabun bitti/)).getByText("Kendi uygular")).toHaveAttribute("data-tone", "success");
  });

  it("filters by search and by autonomy, and offers to clear when nothing matches", async () => {
    const user = renderScreen();
    await row(/Sabun bitti/);

    await user.selectOptions(screen.getByLabelText("Karar yetkisi"), "Müdür karar verir");
    expect(screen.queryByRole("row", { name: /Sabun bitti/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Elektrik arızası/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Politika ara"), "sabun");
    expect(screen.getByText("Aramanıza uyan politika yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtreleri temizle" }));

    expect(screen.getByRole("row", { name: /Sabun bitti/ })).toBeInTheDocument();
  });

  it("changes the autonomy level and the threshold", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti");

    expect(within(sheet).getByRole("radio", { name: /Kendi uygular/ })).toBeChecked();
    await user.click(within(sheet).getByRole("radio", { name: /Uygular, müdüre haber verir/ }));
    const threshold = within(sheet).getByLabelText("Güven eşiği (%)");
    await user.clear(threshold);
    await user.type(threshold, "85");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const soap = await row(/Sabun bitti/);
    expect(within(soap).getByText("Uygular, müdüre haber verir")).toBeInTheDocument();
    expect(within(soap).getByText("%85")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sabun bitti politikası güncellendi.");
  });

  it("explains each autonomy level in the panel", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Elektrik arızası");

    expect(within(sheet).getByRole("radio", { name: /Müdür karar verir/ })).toBeChecked();
    expect(within(sheet).getByText(/İnceleme Kuyruğu'na düşer/)).toBeInTheDocument();
  });

  // Haberi seviye belirler (L2 haber verir); ayri kutu hicbir seyi degistirmiyordu (#93)
  it("has no separate notify option: the level decides it", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Elektrik arızası");

    expect(within(sheet).queryByLabelText("Müdüre haber ver")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Müdüre haber" })).not.toBeInTheDocument();
  });

  it("rejects a threshold outside 0-100 before sending", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti");

    const threshold = within(sheet).getByLabelText("Güven eşiği (%)");
    await user.clear(threshold);
    await user.type(threshold, "140");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Güven eşiği 0 ile 100 arasında bir tam sayı olmalı.")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message when saving fails", async () => {
    server.use(http.patch(apiUrl("/admin/agent-policies/:id"), () => errorResponse(500, "Beklenmeyen bir hata oluştu.")));
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti");

    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Beklenmeyen bir hata oluştu.");
  });

  it("shows an error with retry when policies cannot be loaded", async () => {
    server.use(http.get(apiUrl("/admin/agent-policies"), () => errorResponse(500, "Beklenmeyen bir hata oluştu.")));
    renderScreen();

    expect(await screen.findByText("Yapay zekâ politikaları yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});

describe("AgentPoliciesScreen export", () => {
  beforeEach(() => {
    resetAdminAgentPolicies();
    resetAdminCaseTypes();
  });

  it("exports one policy per type with the threshold in percent", async () => {
    const user = renderScreen();
    await row(/Sabun bitti/);

    const { sheet, fileName } = await exportSheet(user);

    expect(fileName).toMatch(/^yapay-zeka-politikalari-/);
    expect(sheet.rows).toContainEqual(["Elektrik arızası", "ELECTRICAL_FAILURE", "Müdür karar verir", 70]);
  });
});
