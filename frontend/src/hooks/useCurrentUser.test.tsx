import { QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { useCurrentUser } from "./useCurrentUser";

function wrapper({ children }: { children: ReactNode }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function UserName() {
  return <p>{useCurrentUser().data?.full_name ?? "yok"}</p>;
}

describe("useCurrentUser", () => {
  // Kabuk ve sayfa ayni sorguyu kullanir; sonradan acilan bilesen ikinci istek gondermez (Lighthouse: cift /auth/me)
  it("asks /auth/me once even when a second component mounts later", async () => {
    let calls = 0;
    server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname.endsWith("/auth/me")) calls += 1;
    });
    const client = createQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <UserName />
      </QueryClientProvider>,
    );
    await screen.findByText("Ayşe Yılmaz");

    view.rerender(
      <QueryClientProvider client={client}>
        <UserName />
        <UserName />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByText("Ayşe Yılmaz")).toHaveLength(2));

    expect(calls).toBe(1);
    server.events.removeAllListeners();
  });

  it("returns the signed-in user from the mocked /auth/me", async () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.role).toBe("REPORTER");
  });

  it("surfaces backend errors instead of guessing a role", async () => {
    server.use(
      http.get(apiUrl("/auth/me"), () =>
        HttpResponse.json(
          { error: { code: "NOT_IMPLEMENTED", message: "Bu özellik henüz hazır değil.", details: {} } },
          { status: 501 },
        ),
      ),
    );

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
});
