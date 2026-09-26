import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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

describe("useCurrentUser", () => {
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
