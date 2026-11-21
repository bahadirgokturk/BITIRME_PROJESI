// Giris/cikis. Access token bellekte (tokenStore.ts), refresh token backend'in HttpOnly cerezinde.
import type { components } from "@/lib/api/types";

import { apiPost } from "./client";
import { getAccessToken, setAccessToken } from "./tokenStore";

type TokenRead = components["schemas"]["TokenRead"];

export { getAccessToken, setAccessToken };

export async function login(email: string, password: string): Promise<void> {
  const token = await apiPost<TokenRead>("/auth/login", { email, password });
  setAccessToken(token.access_token);
}

// Kendi parolasini degistirir: diger cihazlar cikar, bu cihaz yeni token alir (docs/API.md "Auth")
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = await apiPost<TokenRead>("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  setAccessToken(token.access_token);
}

export async function logout(): Promise<void> {
  try {
    // Backend refresh token'i iptal eder ve cerezi siler
    await apiPost<void>("/auth/logout");
  } finally {
    // Istek basarisiz olsa da bu cihazdaki oturum biter
    setAccessToken(null);
  }
}

export function clearSession(): void {
  setAccessToken(null);
}
