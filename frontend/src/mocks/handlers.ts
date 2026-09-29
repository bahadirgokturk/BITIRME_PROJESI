// Backend'de henuz uygulanmamis (501) endpoint'lerin sahte karsiliklari.
// Kural: backend bir endpoint'i gercekten uyguladiginda buradaki handler'i silin.
// Burada olmayan her istek (ornegin /health) gercek backend'e gider.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { attachmentHandlers } from "./attachmentHandlers";
import { caseHandlers } from "./caseHandlers";
import {
  DEPARTMENTS,
  LOCATIONS,
  MOCK_PASSWORD,
  USERS,
  type Role,
} from "./fixtures";

type Schemas = components["schemas"];

// Sahte token omru; backend JWT_ACCESS_TTL_MIN=30 ile ayni (docs/DEPLOYMENT.md)
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

function mockRole(): Role {
  const role = process.env.NEXT_PUBLIC_MOCK_ROLE as Role | undefined;
  return role && role in USERS ? role : "REPORTER";
}

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1 };
}

const token: Schemas["TokenRead"] = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: ACCESS_TOKEN_TTL_SECONDS,
};

export const handlers = [
  // /auth/*, /admin/* ve /locations backend'de GERCEKTEN hazir (FAZ 2). Bu handler'lar login ekrani
  // access token'i saklayip isteklere ekleyene kadar kalir; o PR'da silinir (frontend/README.md).
  // /cases/* da hazir (E3-1); sahteleri caseHandlers.ts'te, ayni kuralla silinir
  http.post<never, Schemas["LoginRequest"]>(
    apiUrl("/auth/login"),
    async ({ request }) => {
      const { email, password } = await request.json();
      const known = Object.values(USERS).some((user) => user.email === email);
      if (!known || password !== MOCK_PASSWORD) {
        return error(401, "UNAUTHORIZED", "E-posta veya parola hatalı.");
      }
      return HttpResponse.json(token);
    },
  ),
  http.post(apiUrl("/auth/refresh"), () => HttpResponse.json(token)),
  http.post(
    apiUrl("/auth/logout"),
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get(apiUrl("/auth/me"), () => HttpResponse.json(USERS[mockRole()])),

  http.get(apiUrl("/admin/users"), () =>
    HttpResponse.json(page(Object.values(USERS))),
  ),
  http.get(apiUrl("/admin/departments"), () =>
    HttpResponse.json(page(DEPARTMENTS)),
  ),
  http.get(apiUrl("/admin/locations"), () =>
    HttpResponse.json(page(LOCATIONS)),
  ),

  ...caseHandlers,
  ...attachmentHandlers,
];
