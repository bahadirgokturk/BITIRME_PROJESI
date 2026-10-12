// Sahte API: backend acmadan (cevrimdisi) ekran gelistirmek ve testler icin (frontend/README.md).
// Cevaplar gercek API ile ayni sekilde tutulur; NEXT_PUBLIC_API_MOCKING=disabled iken hic yuklenmez.
// Burada olmayan her istek (ornegin /health) gercek backend'e gider.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { analyticsHandlers } from "./analyticsHandlers";
import { adminAgentPolicyHandlers } from "./adminAgentPolicyHandlers";
import { adminAuditLogHandlers } from "./adminAuditLogHandlers";
import { adminCaseTypeHandlers } from "./adminCaseTypeHandlers";
import { adminDepartmentHandlers } from "./adminDepartmentHandlers";
import { adminHandlers } from "./adminHandlers";
import { adminLocationHandlers } from "./adminLocationHandlers";
import { adminSlaRuleHandlers } from "./adminSlaRuleHandlers";
import { attachmentHandlers } from "./attachmentHandlers";
import { caseHandlers } from "./caseHandlers";
import { interactionHandlers } from "./interactionHandlers";
import { managerHandlers } from "./managerHandlers";
import { taskHandlers } from "./taskHandlers";
import { MOCK_PASSWORD, USERS } from "./fixtures";
import { currentUser, signInAs } from "./session";

type Schemas = components["schemas"];

// Sahte token omru; backend JWT_ACCESS_TTL_MIN=30 ile ayni (docs/DEPLOYMENT.md)
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

const token: Schemas["TokenRead"] = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: ACCESS_TOKEN_TTL_SECONDS,
};

export const handlers = [
  // Sahte giris: fixture e-postalari icin ortak parola; /auth/me giris yapani, yoksa NEXT_PUBLIC_MOCK_ROLE rolunu doner.
  // Bildirimler caseHandlers.ts, dosyalar attachmentHandlers.ts, yorum/puan interactionHandlers.ts'te,
  // yonetim kullanicilari adminHandlers.ts'te, birimler adminDepartmentHandlers.ts'te,
  // konumlar adminLocationHandlers.ts'te, bildirim turleri adminCaseTypeHandlers.ts'te,
  // sure hedefleri adminSlaRuleHandlers.ts'te, yapay zeka politikalari adminAgentPolicyHandlers.ts'te,
  // islem kayitlari adminAuditLogHandlers.ts'te.
  http.post<never, Schemas["LoginRequest"]>(
    apiUrl("/auth/login"),
    async ({ request }) => {
      const { email, password } = await request.json();
      const user = Object.values(USERS).find((candidate) => candidate.email === email);
      if (!user || password !== MOCK_PASSWORD) {
        return error(401, "UNAUTHORIZED", "E-posta veya parola hatalı.");
      }
      signInAs(user);
      return HttpResponse.json(token);
    },
  ),
  http.post(apiUrl("/auth/refresh"), () => HttpResponse.json(token)),
  http.post(apiUrl("/auth/logout"), () => {
    signInAs(null);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(apiUrl("/auth/me"), () => HttpResponse.json(currentUser())),


  ...caseHandlers,
  ...attachmentHandlers,
  ...interactionHandlers,
  ...taskHandlers,
  ...managerHandlers,
  ...analyticsHandlers,
  ...adminHandlers,
  ...adminDepartmentHandlers,
  ...adminCaseTypeHandlers,
  ...adminSlaRuleHandlers,
  ...adminAgentPolicyHandlers,
  ...adminAuditLogHandlers,
  ...adminLocationHandlers,
];
