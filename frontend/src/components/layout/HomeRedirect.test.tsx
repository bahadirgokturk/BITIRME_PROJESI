import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { USERS } from "@/mocks/fixtures";
import { server } from "@/mocks/node";

import { HomeRedirect } from "./HomeRedirect";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  replace.mockReset();
});

function renderHome() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <HomeRedirect>
        <p>geçici ana sayfa</p>
      </HomeRedirect>
    </QueryClientProvider>,
  );
}

describe("HomeRedirect", () => {
  it("sends a reporter straight to their cases", async () => {
    renderHome();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/my-cases"));
    expect(screen.queryByText("geçici ana sayfa")).not.toBeInTheDocument();
  });

  it("keeps the placeholder page for a role whose screens are not built yet", async () => {
    server.use(http.get(apiUrl("/auth/me"), () => HttpResponse.json(USERS.STAFF)));

    renderHome();

    expect(await screen.findByText("geçici ana sayfa")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
