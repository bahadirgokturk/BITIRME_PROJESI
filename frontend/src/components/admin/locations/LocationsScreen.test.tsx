import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminLocations } from "@/mocks/adminLocationHandlers";
import { server } from "@/mocks/node";

import { LocationsScreen } from "./LocationsScreen";

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <LocationsScreen />
    </QueryClientProvider>,
  );
  return user;
}

const item = (name: string | RegExp) => screen.findByRole("listitem", { name });

// Sahte liste modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => resetAdminLocations());

describe("LocationsScreen", () => {
  it("shows a skeleton while locations load", () => {
    renderScreen();

    expect(screen.getByLabelText("Konumlar yükleniyor")).toBeInTheDocument();
  });

  it("opens the campus and keeps deeper levels closed", async () => {
    renderScreen();

    const building = await item("B Blok");
    expect(within(building).getByText(/Bina/)).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Merkez Kampüs" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "B Blok 2. Kat" })).not.toBeInTheDocument();
    expect(within(await item("A Blok Otoparkı")).getByText("Pasif")).toBeInTheDocument();
  });

  it("opens and closes a branch", async () => {
    const user = renderScreen();

    await user.click(within(await item("B Blok")).getByRole("button", { name: "B Blok altını aç" }));
    expect(await item("B Blok 2. Kat")).toBeInTheDocument();

    await user.click(within(await item("B Blok")).getByRole("button", { name: "B Blok altını kapat" }));
    expect(screen.queryByRole("listitem", { name: "B Blok 2. Kat" })).not.toBeInTheDocument();
  });

  it("searches every level and shows where each result is", async () => {
    const user = renderScreen();
    await item("B Blok");

    await user.type(screen.getByLabelText("Konum ara"), "amfi");

    const result = await item("B201 Amfi");
    expect(within(result).getByText("Merkez Kampüs › B Blok › B Blok 2. Kat")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Merkez Kampüs" })).not.toBeInTheDocument();
  });

  it("offers to clear the filters when nothing matches", async () => {
    const user = renderScreen();
    await item("B Blok");

    await user.type(screen.getByLabelText("Konum ara"), "olmayan yer");
    expect(screen.getByText("Aramanıza uyan konum yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Süzgeçleri temizle" }));

    expect(screen.getByRole("listitem", { name: "B Blok" })).toBeInTheDocument();
  });

  it("adds a location under the chosen parent", async () => {
    const user = renderScreen();
    await item("B Blok");

    await user.click(screen.getByRole("button", { name: "Konum ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Konum ekle" });
    await user.type(within(sheet).getByLabelText("Konum adı"), "C Blok");
    await user.selectOptions(within(sheet).getByLabelText("Tür"), "Bina");
    await user.type(within(sheet).getByLabelText("Kod"), "C");
    await user.selectOptions(within(sheet).getByLabelText("Üst konum"), "Merkez Kampüs");
    await user.type(within(sheet).getByLabelText("Diğer adlar"), "c blok, yeni bina");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await item("C Blok")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("C Blok eklendi.");
  });

  it("explains a missing name before sending", async () => {
    const user = renderScreen();
    await item("B Blok");

    await user.click(screen.getByRole("button", { name: "Konum ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Konum ekle" });
    await user.type(within(sheet).getByLabelText("Kod"), "C");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Konum adı yazmalısınız.")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message for a duplicate code", async () => {
    const user = renderScreen();
    await item("B Blok");

    await user.click(screen.getByRole("button", { name: "Konum ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Konum ekle" });
    await user.type(within(sheet).getByLabelText("Konum adı"), "Başka B Blok");
    await user.type(within(sheet).getByLabelText("Kod"), "B");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Bu kod zaten kullanılıyor.");
  });

  it("renames a location; kind and code cannot be changed", async () => {
    const user = renderScreen();

    await user.click(within(await item("B Blok")).getByRole("button", { name: "B Blok konumunu düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Konumu düzenle" });
    expect(within(sheet).getByLabelText("Kod")).toHaveAttribute("readonly");
    expect(within(sheet).getByLabelText("Tür")).toBeDisabled();
    const name = within(sheet).getByLabelText("Konum adı");
    await user.clear(name);
    await user.type(name, "B Blok (Mühendislik)");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await item("B Blok (Mühendislik)")).toBeInTheDocument();
  });

  it("deactivates a location from the edit panel", async () => {
    const user = renderScreen();

    await user.click(within(await item("B Blok")).getByRole("button", { name: "B Blok konumunu düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Konumu düzenle" });
    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await item("B Blok")).getByText("Pasif")).toBeInTheDocument();
  });

  it("shows an error with retry when locations cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/admin/locations"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Konumlar yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await item("B Blok")).toBeInTheDocument();
  });
});
