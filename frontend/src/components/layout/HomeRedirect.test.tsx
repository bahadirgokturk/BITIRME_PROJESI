import { QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
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
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <HomeRedirect />
    </QueryClientProvider>,
  );
}

describe("HomeRedirect", () => {
  it("sends a reporter straight to their cases", async () => {
    renderHome();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/my-cases"));
  });

  it.each([
    ["STAFF", "/staff/tasks"],
    ["MANAGER", "/manager/dashboard"],
    ["ADMIN", "/manager/dashboard"],
  ] as const)("sends %s to its own first screen", async (role, path) => {
    server.use(http.get(apiUrl("/auth/me"), () => HttpResponse.json(USERS[role])));

    renderHome();

    await waitFor(() => expect(replace).toHaveBeenCalledWith(path));
  });

  it("shows nothing while it redirects", async () => {
    const { container } = renderHome();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
