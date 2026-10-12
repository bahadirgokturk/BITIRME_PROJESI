import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminCaseTypes } from "@/mocks/adminCaseTypeHandlers";
import { resetAdminDepartments } from "@/mocks/adminDepartmentHandlers";
import { server } from "@/mocks/node";

import { CaseTypesScreen } from "./CaseTypesScreen";

const MAINTENANCE = "Bakım Onarım ve Peyzaj Şube Müdürlüğü";

type User = ReturnType<typeof userEvent.setup>;

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CaseTypesScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

async function openEdit(user: User, name: string) {
  await user.click(within(await row(new RegExp(name))).getByRole("button", { name: `${name} türünü düzenle` }));
  return screen.findByRole("dialog", { name: "Türü düzenle" });
}

async function openAdd(user: User) {
  await row(/Sabun bitti/);
  await user.click(screen.getByRole("button", { name: "Tür ekle" }));
  return screen.findByRole("dialog", { name: "Tür ekle" });
}

// Sahte listeler modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => {
  resetAdminCaseTypes();
  resetAdminDepartments();
});

describe("CaseTypesScreen", () => {
  it("shows a skeleton while case types load", () => {
    renderScreen();

    expect(screen.getByLabelText("Bildirim türleri yükleniyor")).toBeInTheDocument();
  });

  it("lists each type with code, category, department, priority and status", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("ELECTRICAL_FAILURE")).toBeInTheDocument();
    expect(within(power).getByText("Güvenlikle ilgili")).toBeInTheDocument();
    expect(within(power).getByText("Teknik")).toBeInTheDocument();
    expect(await within(power).findByText(MAINTENANCE)).toBeInTheDocument();
    expect(within(power).getByText("Yüksek")).toBeInTheDocument();
    expect(within(power).getByText("Aktif")).toBeInTheDocument();
    expect(within(await row(/Kapsam dışı talep/)).getByText("Birim yok")).toBeInTheDocument();
    expect(within(await row(/Kayıp/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByText("6 tür · 5 aktif")).toBeInTheDocument();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("Teknik").closest("td")).toHaveAttribute("data-label", "Kategori");
    expect(within(power).getByText("Yüksek").closest("td")).toHaveAttribute("data-label", "Öncelik");
  });

  it("filters by keyword search and by category, and offers to clear when nothing matches", async () => {
    const user = renderScreen();
    await row(/Sabun bitti/);

    await user.type(screen.getByLabelText("Tür ara"), "priz");
    expect(screen.queryByRole("row", { name: /Sabun bitti/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Elektrik arızası/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Kategori"), "Temizlik");
    expect(screen.getByText("Aramanıza uyan tür yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtreleri temizle" }));

    expect(screen.getByRole("row", { name: /Sabun bitti/ })).toBeInTheDocument();
  });

  it("adds a type with department and keywords, and explains how the AI will find it", async () => {
    const user = renderScreen();
    const sheet = await openAdd(user);
    expect(within(sheet).getByText(/model yeniden eğitilene kadar anahtar kelimelerle bulunur/)).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText("Tür adı"), "Asansör");
    await user.type(within(sheet).getByLabelText("Kod"), "asansör 1");
    expect(within(sheet).getByLabelText("Kod")).toHaveValue("ASANSOR_1");
    await user.selectOptions(within(sheet).getByLabelText("Kategori"), "Teknik");
    await user.selectOptions(within(sheet).getByLabelText("Görevi alan birim"), MAINTENANCE);
    await user.type(within(sheet).getByLabelText("Anahtar kelimeler"), "kabin");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    const added = await row(/Asansör/);
    expect(within(added).getByText("ASANSOR_1")).toBeInTheDocument();
    expect(within(added).getByText(MAINTENANCE)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Asansör eklendi.");
  });

  it("explains missing fields before sending", async () => {
    const user = renderScreen();
    const sheet = await openAdd(user);

    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Tür adı yazmalısınız.")).toBeInTheDocument();
    expect(within(sheet).getByText("Kod yazmalısınız.")).toBeInTheDocument();
    expect(within(sheet).getByText("Kategori seçmelisiniz.")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message for a duplicate code", async () => {
    const user = renderScreen();
    const sheet = await openAdd(user);

    await user.type(within(sheet).getByLabelText("Tür adı"), "Sabun yok");
    await user.type(within(sheet).getByLabelText("Kod"), "SOAP_EMPTY");
    await user.selectOptions(within(sheet).getByLabelText("Kategori"), "Sarf malzemesi");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Bu kod zaten kullanılıyor.");
  });

  it("edits a type: the code is locked and the department can be removed", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Elektrik arızası");

    expect(within(sheet).getByLabelText("Kod")).toHaveAttribute("readonly");
    expect(within(sheet).getByLabelText("Güvenlikle ilgili")).toBeChecked();
    expect(within(sheet).getByLabelText("Anahtar kelimeler")).toHaveValue("elektrik, priz, sigorta, kıvılcım");
    await user.selectOptions(within(sheet).getByLabelText("Görevi alan birim"), "Birim yok (müdür karar verir)");
    await user.selectOptions(within(sheet).getByLabelText("Başlangıç önceliği"), "Kritik");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const power = await row(/Elektrik arızası/);
    expect(within(power).getByText("Birim yok")).toBeInTheDocument();
    expect(within(power).getByText("Kritik")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Elektrik arızası güncellendi.");
  });

  it("rejects a severity outside 0-100", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti");

    const severity = within(sheet).getByLabelText("Ciddiyet (0–100)");
    await user.clear(severity);
    await user.type(severity, "140");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Ciddiyet 0 ile 100 arasında bir tam sayı olmalı.")).toBeInTheDocument();
  });

  it("deactivates a type from the edit panel", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sabun bitti");

    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Sabun bitti/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sabun bitti pasifleştirildi.");
  });

  it("shows an error with retry when case types cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/admin/case-types"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } },
          { status: 500 },
        ),
      ),
    );
    renderScreen();

    expect(await screen.findByText("Bildirim türleri yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
