import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { LoginScreen } from "./LoginScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

function renderScreen() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <LoginScreen />
    </QueryClientProvider>,
  );
}

describe("LoginScreen", () => {
  it("shows the brand, the heading and the form", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 1, name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.getByText("Kurum e-postan ve parolanla giriş yap.")).toBeInTheDocument();
    expect(screen.getByText("Kampüsteki sorunları bildir, çözülene kadar takip et.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-posta")).toBeInTheDocument();
    expect(screen.getByLabelText("Parola")).toBeInTheDocument();
  });

  it("tells the user where to go when the password is forgotten", () => {
    renderScreen();

    expect(
      screen.getByText("Parolanı mı unuttun? Birim yöneticine ya da sistem yöneticisine başvur."),
    ).toBeInTheDocument();
  });

  it("disables the button while signing in", async () => {
    server.use(
      http.post(apiUrl("/auth/login"), async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderScreen();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("E-posta"), "ogrenci@kampus.example.com");
    await user.type(screen.getByLabelText("Parola"), "parola123");
    await user.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByRole("button", { name: "Giriş yapılıyor…" })).toBeDisabled();
  });
});
