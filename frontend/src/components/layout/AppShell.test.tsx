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
      within(nav).queryByRole("link", { name: "Genel bakış" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("içerik")).toBeInTheDocument();
    expect(screen.getByText("Mehmet Demir")).toBeInTheDocument();
  });

  it("highlights the current page in the menu", () => {
    renderShell(<p>içerik</p>);

    const nav = screen.getByRole("navigation", { name: "Ana menü" });
    expect(within(nav).getByRole("link", { name: "Görevlerim" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Bildirim yap" })).not.toHaveAttribute("aria-current");
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
