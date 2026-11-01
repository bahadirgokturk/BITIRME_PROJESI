import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminCaseTypes } from "@/mocks/adminCaseTypeHandlers";
import { resetAdminSlaRules } from "@/mocks/adminSlaRuleHandlers";
import { server } from "@/mocks/node";

import { SlaRulesScreen } from "./SlaRulesScreen";

type User = ReturnType<typeof userEvent.setup>;

const DEFAULT = "Varsayılan (tüm türler)";

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SlaRulesScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

async function openEdit(user: User, rule: string) {
  await user.click(await screen.findByRole("button", { name: `${rule} kuralını düzenle` }));
  return screen.findByRole("dialog", { name: "Kuralı düzenle" });
}

async function openAdd(user: User) {
  await row(/Elektrik arızası/);
  await user.click(screen.getByRole("button", { name: "Kural ekle" }));
  return screen.findByRole("dialog", { name: "Kural ekle" });
}

// Sure "3 saat" gibi yazilir: sayi kutuya, birim secim kutusuna girilir
async function fillDuration(user: User, sheet: HTMLElement, label: string, duration: string) {
  const [amount = "", unit = ""] = duration.split(" ");
  const input = within(sheet).getByLabelText(label);
  await user.clear(input);
  await user.type(input, amount);
  await user.selectOptions(within(sheet).getByLabelText(`${label} birimi`), unit);
}

// Sahte listeler modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => {
  resetAdminSlaRules();
  resetAdminCaseTypes();
});

describe("SlaRulesScreen", () => {
  it("shows a skeleton while rules load", () => {
    renderScreen();

    expect(screen.getByLabelText("Süre hedefleri yükleniyor")).toBeInTheDocument();
  });

  it("lists rules with readable durations, default rules first", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("ELECTRICAL_FAILURE")).toBeInTheDocument();
    expect(within(power).getByText("Yüksek")).toBeInTheDocument();
    expect(within(power).getByText("15 dk")).toBeInTheDocument();
    expect(within(power).getByText("2 saat")).toBeInTheDocument();
    expect(within(power).getByText("%75")).toBeInTheDocument();
    expect(within(power).getByText("Aktif")).toBeInTheDocument();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.slice(0, 4).every((item) => within(item).queryByText(DEFAULT))).toBe(true);
    expect(within(rows[0] as HTMLElement).getByText("1 gün")).toBeInTheDocument();
    expect(within(await row(/Kayıp/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByText("7 kural, 6 aktif").closest("[data-slot=admin-table]")).not.toBeNull();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("15 dk").closest("td")).toHaveAttribute("data-label", "Kabul hedefi");
    expect(within(power).getByText("2 saat").closest("td")).toHaveAttribute("data-label", "Çözüm hedefi");
  });

  it("filters by type name and priority, and offers to clear when nothing matches", async () => {
    const user = renderScreen();
    await row(/Elektrik arızası/);

    await user.type(screen.getByLabelText("Kural ara"), "sabun");
    expect(screen.queryByRole("row", { name: /Elektrik arızası/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Sabun bitti/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Öncelik"), "Kritik");
    expect(screen.getByText("Aramanıza uyan kural yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtreleri temizle" }));

    expect(screen.getByRole("row", { name: /Elektrik arızası/ })).toBeInTheDocument();
  });

  it("adds a rule for a type, writing durations with units", async () => {
    const user = renderScreen();
    const sheet = await openAdd(user);

    await user.selectOptions(within(sheet).getByLabelText("Tür"), "İnternet kesintisi");
    await user.selectOptions(within(sheet).getByLabelText("Öncelik"), "Orta");
    await fillDuration(user, sheet, "Kabul hedefi", "1 saat");
    await fillDuration(user, sheet, "Çözüm hedefi", "1 gün");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    const added = await row(/İnternet kesintisi/);
    expect(within(added).getByText("1 saat")).toBeInTheDocument();
    expect(within(added).getByText("1 gün")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("İnternet kesintisi · Orta kuralı eklendi.");
  });

  it("explains a second rule for the same target before sending", async () => {
    const user = renderScreen();
    const sheet = await openAdd(user);

    await user.selectOptions(within(sheet).getByLabelText("Öncelik"), "Kritik");
    await fillDuration(user, sheet, "Kabul hedefi", "10 dakika");
    await fillDuration(user, sheet, "Çözüm hedefi", "1 saat");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Bu tür ve öncelik için zaten bir kural var.")).toBeInTheDocument();
  });

  it("does not allow a resolution target shorter than the acceptance target", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Elektrik arızası Yüksek");

    await fillDuration(user, sheet, "Çözüm hedefi", "10 dakika");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Çözüm hedefi kabul hedefinden kısa olamaz.")).toBeInTheDocument();
  });

  it("edits the durations; the type and priority are locked", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Elektrik arızası Yüksek");

    expect(within(sheet).getByLabelText("Tür")).toBeDisabled();
    expect(within(sheet).getByLabelText("Öncelik")).toBeDisabled();
    expect(within(sheet).getByLabelText("Kabul hedefi")).toHaveValue("15");
    await fillDuration(user, sheet, "Çözüm hedefi", "3 saat");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Elektrik arızası/)).getByText("3 saat")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Elektrik arızası · Yüksek kuralı güncellendi.");
  });

  it("keeps the panel open and shows the backend message when saving fails", async () => {
    server.use(
      http.patch(apiUrl("/admin/sla-rules/:id"), () =>
        HttpResponse.json(
          { error: { code: "INVALID_SLA_TARGETS", message: "Çözüm süresi, kabul süresinden kısa olamaz.", details: {} } },
          { status: 422 },
        ),
      ),
    );
    const user = renderScreen();
    const sheet = await openEdit(user, `${DEFAULT} Kritik`);

    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Çözüm süresi, kabul süresinden kısa olamaz.");
  });

  it("deactivates a rule from the edit panel", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti Düşük");

    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Sabun bitti/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sabun bitti · Düşük kuralı pasifleştirildi.");
  });

  it("shows an error with retry when rules cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/admin/sla-rules"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } },
          { status: 500 },
        ),
      ),
    );
    renderScreen();

    expect(await screen.findByText("Süre hedefleri yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
