import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { USERS } from "@/mocks/fixtures";
import { server } from "@/mocks/node";
import { resetNotifications } from "@/mocks/notificationHandlers";
import { signInAs } from "@/mocks/session";

import { NotificationBell } from "./NotificationBell";

function renderBell() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NotificationBell />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const bell = (name: RegExp) => screen.findByRole("button", { name }, { timeout: 3000 });

beforeEach(() => resetNotifications());
afterEach(() => signInAs(null));

describe("NotificationBell", () => {
  it("shows how many notifications are unread", async () => {
    renderBell();

    expect(await bell(/2 okunmamış/)).toHaveTextContent("2");
  });

  it("lists the notifications with the newest first and opens a case on the role's own screen", async () => {
    signInAs(USERS.REPORTER);
    const user = renderBell();

    await user.click(await bell(/2 okunmamış/));
    const list = await screen.findByRole("list", { name: "Son bildirimler" });
    const links = within(list).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Bildiriminiz için ek bilgi istendi.");
    expect(links[0]).toHaveTextContent("Amfide garip bir koku var");
    expect(links[0]).toHaveAttribute("href", "/cases/104");
  });

  // Tiklanan bildirim okundu sayilir; rozet bir azalir
  it("marks a notification read when it is opened", async () => {
    const user = renderBell();

    await user.click(await bell(/2 okunmamış/));
    const list = await screen.findByRole("list", { name: "Son bildirimler" });
    await user.click(within(list).getAllByRole("link")[0]!);

    expect(await bell(/1 okunmamış/)).toBeInTheDocument();
  });

  it("marks everything read at once", async () => {
    const user = renderBell();

    await user.click(await bell(/2 okunmamış/));
    await user.click(await screen.findByRole("button", { name: "Tümünü okundu say" }));

    expect(await bell(/okunmamış yok/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Tümünü okundu say" })).not.toBeInTheDocument());
  });

  it("says so when there are no notifications", async () => {
    server.use(
      http.get(apiUrl("/notifications/unread-count"), () => HttpResponse.json({ count: 0 })),
      http.get(apiUrl("/notifications"), () => HttpResponse.json({ items: [], total: 0, page: 1 })),
    );
    const user = renderBell();

    await user.click(await bell(/okunmamış yok/));

    expect(await screen.findByText("Henüz bildirim yok.")).toBeInTheDocument();
  });

  it("explains when the list cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/notifications"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Sunucu hatası.", details: {} } },
          { status: 500 },
        ),
      ),
    );
    const user = renderBell();

    await user.click(await bell(/2 okunmamış/));

    expect(await screen.findByText("Bildirimler yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
