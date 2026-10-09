import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminDepartments } from "@/mocks/adminDepartmentHandlers";
import { resetAdminUsers } from "@/mocks/adminHandlers";
import { server } from "@/mocks/node";

import { DepartmentsScreen } from "./DepartmentsScreen";

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DepartmentsScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

// Sahte listeler modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => {
  resetAdminDepartments();
  resetAdminUsers();
});

describe("DepartmentsScreen", () => {
  it("shows a skeleton while departments load", () => {
    renderScreen();

    expect(screen.getByLabelText("Birimler yükleniyor")).toBeInTheDocument();
  });

  it("lists departments with code, user count and status", async () => {
    renderScreen();

    const support = await row(/Destek Hizmetleri Şube Müdürlüğü/);
    expect(within(support).getByText("SUPPORT_SERVICES")).toBeInTheDocument();
    expect(await within(support).findByText("2 kullanıcı")).toBeInTheDocument();
    expect(within(support).getByText("Aktif")).toBeInTheDocument();
    expect(await within(await row(/Beslenme Hizmetleri/)).findByText("Kullanıcı yok")).toBeInTheDocument();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const support = await row(/Destek Hizmetleri Şube Müdürlüğü/);
    expect(within(support).getByText("SUPPORT_SERVICES").closest("td")).toHaveAttribute("data-label", "Kod");
  });

  it("filters by search text and offers to clear when nothing matches", async () => {
    const user = renderScreen();
    await row(/Beslenme Hizmetleri/);

    await user.type(screen.getByLabelText("Birim ara"), "beslenme");
    expect(screen.queryByRole("row", { name: /Destek Hizmetleri/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Beslenme Hizmetleri/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Birim ara"), " yok böyle");
    expect(screen.getByText("Aramanıza uyan birim yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Süzgeçleri temizle" }));

    expect(screen.getByRole("row", { name: /Destek Hizmetleri Şube Müdürlüğü/ })).toBeInTheDocument();
  });

  it("adds a department and writes the code in the accepted format", async () => {
    const user = renderScreen();
    await row(/Beslenme Hizmetleri/);

    await user.click(screen.getByRole("button", { name: "Birim ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Birim ekle" });
    await user.type(within(sheet).getByLabelText("Birim adı"), "Kütüphane Şube Müdürlüğü");
    await user.type(within(sheet).getByLabelText("Kod"), "kütüphane 1");
    expect(within(sheet).getByLabelText("Kod")).toHaveValue("KUTUPHANE_1");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(within(await row(/Kütüphane Şube Müdürlüğü/)).getByText("KUTUPHANE_1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Kütüphane Şube Müdürlüğü eklendi.");
  });

  it("explains a missing name before sending", async () => {
    const user = renderScreen();
    await row(/Beslenme Hizmetleri/);

    await user.click(screen.getByRole("button", { name: "Birim ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Birim ekle" });
    await user.type(within(sheet).getByLabelText("Kod"), "LIBRARY");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Birim adı yazmalısınız.")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message for a duplicate code", async () => {
    const user = renderScreen();
    await row(/Beslenme Hizmetleri/);

    await user.click(screen.getByRole("button", { name: "Birim ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Birim ekle" });
    await user.type(within(sheet).getByLabelText("Birim adı"), "Yemekhane");
    await user.type(within(sheet).getByLabelText("Kod"), "NUTRITION");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Bu kod zaten kullanılıyor.");
  });

  it("renames a department; the code cannot be changed", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Beslenme Hizmetleri/)).getByRole("button", { name: "Beslenme Hizmetleri birimini düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Birimi düzenle" });
    expect(within(sheet).getByLabelText("Kod")).toHaveAttribute("readonly");
    const name = within(sheet).getByLabelText("Birim adı");
    await user.clear(name);
    await user.type(name, "Beslenme ve Yemekhane Hizmetleri");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await row(/Beslenme ve Yemekhane Hizmetleri/)).toBeInTheDocument();
  });

  it("deactivates a department from the edit panel", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Beslenme Hizmetleri/)).getByRole("button", { name: "Beslenme Hizmetleri birimini düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Birimi düzenle" });
    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Beslenme Hizmetleri/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Beslenme Hizmetleri pasifleştirildi.");
  });

  it("shows an error with retry when departments cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/admin/departments"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Birimler yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await row(/Beslenme Hizmetleri/)).toBeInTheDocument();
  });
});
