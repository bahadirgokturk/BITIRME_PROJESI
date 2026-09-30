import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { CurrentUserShell } from "./CurrentUserShell";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/my-cases",
}));

describe("CurrentUserShell", () => {
  it("keeps showing the known user when a background refetch fails", async () => {
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <CurrentUserShell>
          <p>içerik</p>
        </CurrentUserShell>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Ayşe Yılmaz")).toBeInTheDocument();

    // Sekmeye geri donuldugunde yapilan yenileme basarisiz olsun
    server.use(
      http.get(apiUrl("/auth/me"), () =>
        HttpResponse.json(
          {
            error: {
              code: "NOT_IMPLEMENTED",
              message: "Bu özellik henüz hazır değil.",
              details: {},
            },
          },
          { status: 501 },
        ),
      ),
    );
    await client.refetchQueries({ queryKey: ["auth", "me"] });

    await waitFor(() =>
      expect(client.getQueryState(["auth", "me"])?.status).toBe("error"),
    );
    expect(screen.getByText("Ayşe Yılmaz")).toBeInTheDocument();
    expect(screen.getByText("içerik")).toBeInTheDocument();
  });
});

describe("CurrentUserShell without a session", () => {
  it("sends the visitor to the login page", async () => {
    server.use(
      http.get(apiUrl("/auth/me"), () =>
        HttpResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Oturum yok.",
              details: {},
            },
          },
          { status: 401 },
        ),
      ),
      http.post(apiUrl("/auth/refresh"), () =>
        HttpResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Oturum yok.",
              details: {},
            },
          },
          { status: 401 },
        ),
      ),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CurrentUserShell>
          <p>gizli içerik</p>
        </CurrentUserShell>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("gizli içerik")).not.toBeInTheDocument();
  });
});
