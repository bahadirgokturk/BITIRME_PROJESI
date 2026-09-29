import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { server } from "@/mocks/node";

import { ApiError, apiGet, apiUrl } from "./client";
import {
  clearSession,
  getAccessToken,
  login,
  logout,
  setAccessToken,
} from "./session";

const unauthorized = () =>
  HttpResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Oturumunuz geçersiz.",
        details: {},
      },
    },
    { status: 401 },
  );
const token = (value: string) =>
  HttpResponse.json({
    access_token: value,
    token_type: "bearer",
    expires_in: 1800,
  });

afterEach(() => clearSession());

describe("session", () => {
  it("sends the access token as a Bearer header", async () => {
    setAccessToken("t-1");
    let seen: string | null = null;
    server.use(
      http.get(apiUrl("/cases/mine"), ({ request }) => {
        seen = request.headers.get("Authorization");
        return HttpResponse.json({ items: [], total: 0, page: 1 });
      }),
    );

    await apiGet("/cases/mine");

    expect(seen).toBe("Bearer t-1");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    setAccessToken("expired");
    server.use(
      http.post(apiUrl("/auth/refresh"), () => token("fresh")),
      http.get(apiUrl("/cases/mine"), ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ items: [], total: 0, page: 1 })
          : unauthorized(),
      ),
    );

    await expect(apiGet("/cases/mine")).resolves.toMatchObject({ total: 0 });
    expect(getAccessToken()).toBe("fresh");
  });

  it("clears the session when the refresh cookie is also invalid", async () => {
    setAccessToken("expired");
    server.use(
      http.post(apiUrl("/auth/refresh"), unauthorized),
      http.get(apiUrl("/cases/mine"), unauthorized),
    );

    const error = await apiGet("/cases/mine").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
  });

  it("shares one refresh between parallel requests", async () => {
    // Iki ayri yenileme ayni cerezi iki kez kullanir; backend bunu calinma sayabilir
    setAccessToken("expired");
    let refreshes = 0;
    server.use(
      http.post(apiUrl("/auth/refresh"), async () => {
        refreshes += 1;
        return token("fresh");
      }),
      http.get(apiUrl("/cases/mine"), ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ items: [], total: 0, page: 1 })
          : unauthorized(),
      ),
    );

    await Promise.all([
      apiGet("/cases/mine"),
      apiGet("/cases/mine"),
      apiGet("/cases/mine"),
    ]);

    expect(refreshes).toBe(1);
  });

  it("does not try to refresh when the login itself fails", async () => {
    let refreshes = 0;
    server.use(
      http.post(apiUrl("/auth/login"), unauthorized),
      http.post(apiUrl("/auth/refresh"), () => {
        refreshes += 1;
        return token("x");
      }),
    );

    await expect(login("a@b.c", "yanlis")).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshes).toBe(0);
  });

  it("stores the token after login and forgets it after logout", async () => {
    server.use(
      http.post(apiUrl("/auth/login"), () => token("t-login")),
      http.post(
        apiUrl("/auth/logout"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await login("a@b.c", "dogru-parola");
    expect(getAccessToken()).toBe("t-login");

    await logout();
    expect(getAccessToken()).toBeNull();
  });
});

describe("session after a page reload", () => {
  it("restores the session from the refresh cookie when /auth/me answers 401", async () => {
    // Sayfa yenilenince bellekteki token yoktur; ilk istek /auth/me'dir
    server.use(
      http.post(apiUrl("/auth/refresh"), () => token("restored")),
      http.get(apiUrl("/auth/me"), ({ request }) =>
        request.headers.get("Authorization") === "Bearer restored"
          ? HttpResponse.json({ id: 1, full_name: "Demo Öğrenci" })
          : unauthorized(),
      ),
    );

    await expect(apiGet("/auth/me")).resolves.toMatchObject({ id: 1 });
    expect(getAccessToken()).toBe("restored");
  });
});
