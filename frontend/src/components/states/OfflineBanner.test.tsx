import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { markServerReachable } from "@/lib/api/reachability";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { OfflineBanner, RECONNECT_CHECK_MS } from "./OfflineBanner";

const MESSAGE = "İnternet bağlantınız yok. Bağlanınca sayfa yenilenir.";

function renderBanner() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <OfflineBanner />
    </QueryClientProvider>,
  );
}

function goOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  markServerReachable(true);
});

describe("OfflineBanner", () => {
  it("stays empty while the device is online", () => {
    renderBanner();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("tells the user when the connection drops and hides when it returns", () => {
    renderBanner();

    goOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent(MESSAGE);

    goOnline(true);
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  // Windows'ta sanal ag kartlari (Docker, WSL) varken tarayici Wi-Fi kapali olsa da "bagliyim" der
  it("also shows when requests fail although the browser says online, and hides once the server answers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(http.get(apiUrl("/health"), () => HttpResponse.json({ status: "ok", database: "ok" })));
    renderBanner();

    act(() => markServerReachable(false));
    expect(screen.getByRole("status")).toHaveTextContent(MESSAGE);

    await act(() => vi.advanceTimersByTimeAsync(RECONNECT_CHECK_MS));

    expect(await screen.findByRole("status")).toBeEmptyDOMElement();
  });
});
