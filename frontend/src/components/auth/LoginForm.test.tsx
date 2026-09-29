import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { clearSession, getAccessToken } from "@/lib/api/session";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { LoginForm } from "./LoginForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  clearSession();
  replace.mockReset();
});

function renderForm() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-posta"), email);
  await user.type(screen.getByLabelText("Parola"), password);
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
}

describe("LoginForm", () => {
  it("logs in and goes to the home page", async () => {
    server.use(
      http.post(apiUrl("/auth/login"), () =>
        HttpResponse.json({
          access_token: "t-ok",
          token_type: "bearer",
          expires_in: 1800,
        }),
      ),
    );
    renderForm();

    await submit("ogrenci@kampus.example.com", "dogru-parola");

    expect(getAccessToken()).toBe("t-ok");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the backend message on wrong credentials and stays on the page", async () => {
    server.use(
      http.post(apiUrl("/auth/login"), () =>
        HttpResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "E-posta veya parola hatalı.",
              details: {},
            },
          },
          { status: 401 },
        ),
      ),
    );
    renderForm();

    await submit("ogrenci@kampus.example.com", "yanlis");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-posta veya parola hatalı.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it("tells the user when the server cannot be reached", async () => {
    server.use(http.post(apiUrl("/auth/login"), () => HttpResponse.error()));
    renderForm();

    await submit("ogrenci@kampus.example.com", "parola123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sunucuya ulaşılamadı",
    );
  });
});
