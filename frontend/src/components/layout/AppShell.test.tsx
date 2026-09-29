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
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function renderShell(children: ReactNode) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AppShell role="STAFF" userName="Mehmet Demir">
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
      within(nav).queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("içerik")).toBeInTheDocument();
    expect(screen.getByText("Mehmet Demir")).toBeInTheDocument();
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
