import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { getAccessToken, setAccessToken } from "@/lib/api/session";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { AppShell } from "./AppShell";

const replace = vi.fn();
let pathname = "/staff/tasks";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));

function renderShell(children: ReactNode, path = "/staff/tasks") {
  pathname = path;
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AppShell role="STAFF" userName="Mehmet Demir" userDetail="Personel">
        {children}
      </AppShell>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("renders the menu of the given role", () => {
    renderShell(<p>içerik</p>);

    const nav = screen.getByRole("navigation", { name: "Ana menü" });
    expect(
      within(nav).getByRole("link", { name: "Görevlerim" }),
    ).toHaveAttribute("href", "/staff/tasks");
    expect(
      within(nav).queryByRole("link", { name: "Genel Bakış" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("içerik")).toBeInTheDocument();
    expect(screen.getByText("Mehmet Demir")).toBeInTheDocument();
  });

  // Telefon ust cubugunda ve masaustu menusunde birer tane
  it("offers the dark mode switch on phone and desktop", () => {
    renderShell(<p>içerik</p>);

    expect(screen.getAllByRole("button", { name: "Koyu mod" })).toHaveLength(2);
  });

  // Masaustunde icerik panelinin ustu: bolum adi, zil ve tema (Figma: 08 Yeni Stil (A))
  it("shows the section name, the bell and the theme switch above the page on desktop", async () => {
    renderShell(<p>içerik</p>, "/staff/tasks/203");

    const bar = screen.getByRole("banner", { name: "Sayfa çubuğu" });
    expect(within(bar).getByText("Görevlerim")).toBeInTheDocument();
    expect(await within(bar).findByRole("button", { name: /^Bildirimler:/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Koyu mod" })).toBeInTheDocument();
  });

  it("groups the desktop menu under headings", () => {
    renderShell(<p>içerik</p>);

    const nav = screen.getByRole("navigation", { name: "Ana menü" });
    const work = within(nav).getByRole("group", { name: "İş" });
    expect(within(work).getByRole("link", { name: "Görevlerim" })).toBeInTheDocument();
    expect(within(nav).getByRole("group", { name: "Kişisel" })).toBeInTheDocument();
  });

  it("shows who is signed in with the logout at the bottom of the desktop menu", () => {
    renderShell(<p>içerik</p>);

    const account = screen.getByRole("region", { name: "Hesap" });
    expect(within(account).getByText("Mehmet Demir")).toBeInTheDocument();
    expect(within(account).getByText("Personel")).toBeInTheDocument();
    expect(within(account).getByRole("button", { name: "Çıkış yap" })).toBeInTheDocument();
  });

  // Masaustu kenar cubugu ust cubuktaki dugmeyle gizlenir; secim cihazda hatirlanir (Figma: 08 Yeni Stil (A))
  it("hides and shows the desktop menu from the page bar and remembers the choice", async () => {
    localStorage.clear();
    renderShell(<p>içerik</p>);
    const user = userEvent.setup();

    const hide = screen.getByRole("button", { name: "Menüyü gizle" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    await user.click(hide);

    expect(screen.queryByRole("region", { name: "Hesap" })).not.toBeInTheDocument();
    expect(localStorage.getItem("bakircayflow-sidebar")).toBe("closed");
    const show = screen.getByRole("button", { name: "Menüyü göster" });
    expect(show).toHaveAttribute("aria-expanded", "false");

    await user.click(show);
    expect(screen.getByRole("region", { name: "Hesap" })).toBeInTheDocument();
    localStorage.clear();
  });

  it("highlights the current page in the menu", () => {
    renderShell(<p>içerik</p>);

    const nav = screen.getByRole("navigation", { name: "Ana menü" });
    expect(within(nav).getByRole("link", { name: "Görevlerim" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Bildirim Yap" })).not.toHaveAttribute("aria-current");
  });

  it("opens the mobile menu panel with the same items and logout", async () => {
    renderShell(<p>içerik</p>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Menüyü aç" }));

    const panel = await screen.findByRole("dialog", { name: "Menü" });
    expect(within(panel).getByRole("link", { name: "Görevlerim" })).toHaveAttribute("aria-current", "page");
    expect(within(panel).getByText("Personel")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Çıkış yap" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Menüyü kapat" })).toBeInTheDocument();
  });

  it("shows a back bar instead of the menu on a detail page", () => {
    renderShell(<p>içerik</p>, "/cases/101");

    expect(screen.getByRole("link", { name: "Geri" })).toHaveAttribute("href", "/my-cases");
    expect(screen.getByText("Bildirim")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menüyü aç" })).not.toBeInTheDocument();
  });

  it("logs out: forgets the token and goes to the login page", async () => {
    setAccessToken("t-1");
    server.use(
      http.post(
        apiUrl("/auth/logout"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderShell(<p>içerik</p>);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Çıkış yap" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(getAccessToken()).toBeNull();
  });
});
