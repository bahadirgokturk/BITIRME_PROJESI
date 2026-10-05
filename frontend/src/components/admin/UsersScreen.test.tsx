import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminUsers } from "@/mocks/adminHandlers";
import { server } from "@/mocks/node";

import { UsersScreen } from "./UsersScreen";

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <UsersScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

// Sahte kullanici listesi modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => resetAdminUsers());

describe("UsersScreen", () => {
  it("shows a skeleton while users load", () => {
    renderScreen();

    expect(screen.getByLabelText("Kullanıcılar yükleniyor")).toBeInTheDocument();
  });

  it("lists users with their role, department or reporter kind and status", async () => {
    renderScreen();

    const staff = await row(/Mehmet Demir/);
    expect(within(staff).getByText("Personel")).toBeInTheDocument();
    expect(await within(staff).findByText("Destek Hizmetleri Şube Müdürlüğü")).toBeInTheDocument();
    expect(within(await row(/Ayşe Yılmaz/)).getByText("Öğrenci")).toBeInTheDocument();
    expect(within(await row(/Ali Çelik/)).getByText("Pasif")).toBeInTheDocument();
  });

  it("filters the table by search text and role", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.type(screen.getByLabelText("Kullanıcı ara"), "zeynep");
    expect(screen.queryByRole("row", { name: /Mehmet Demir/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Zeynep Kaya/ })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Kullanıcı ara"));
    await user.selectOptions(screen.getByLabelText("Rol"), "Personel");
    expect(screen.queryByRole("row", { name: /Zeynep Kaya/ })).not.toBeInTheDocument();
  });

  it("adds a reporter", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Elif Arslan");
    await user.type(within(sheet).getByLabelText("E-posta"), "elif@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Rol"), "Bildirim yapan");
    await user.selectOptions(within(sheet).getByLabelText("Kullanıcı türü"), "Akademik personel");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await row(/Elif Arslan/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Elif Arslan eklendi.");
  });

  it("explains a missing department before sending (staff needs one)", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Can Yurt");
    await user.type(within(sheet).getByLabelText("E-posta"), "can@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Rol"), "Personel");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Birim seçmelisiniz.")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Can Yurt/ })).not.toBeInTheDocument();
  });

  it("edits a user's name", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Mehmet Demir/)).getByRole("button", { name: "Mehmet Demir kullanıcısını düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcıyı düzenle" });
    const name = within(sheet).getByLabelText("Ad soyad");
    await user.clear(name);
    await user.type(name, "Mehmet Demirci");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await row(/Mehmet Demirci/)).toBeInTheDocument();
  });

  it("deactivates a user from the edit panel", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Mehmet Demir/)).getByRole("button", { name: "Mehmet Demir kullanıcısını düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcıyı düzenle" });
    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Mehmet Demir/)).getByText("Pasif")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message for a duplicate e-mail", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Ayşe Yılmaz");
    await user.type(within(sheet).getByLabelText("E-posta"), "ayse.ogrenci@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Kullanıcı türü"), "Öğrenci");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Bu e-posta adresi zaten kayıtlı.");
  });

  it("shows an error with retry when users cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/admin/users"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Kullanıcılar yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await row(/Mehmet Demir/)).toBeInTheDocument();
  });
});
