// Backend REST istemcisi. Hata yutulmaz: her basarisiz yanit ApiError olarak firlatilir.
// Oturum: access token Authorization basligina eklenir; 401 gelirse HttpOnly refresh cerezi ile
// bir kez yenilenip istek tekrarlanir (docs/API.md "Auth").
import type { components } from "@/lib/api/types";

import { getAccessToken, setAccessToken } from "./tokenStore";

type ErrorEnvelope = components["schemas"]["ErrorRead"];
type TokenRead = components["schemas"]["TokenRead"];

const UNAUTHORIZED = 401;
const NO_CONTENT = 204;
// Oturumu kuran/bitiren uclarin 401'i kesindir: yenileme denenmez (sonsuz dongu olmasin).
// /auth/me bu listede DEGIL: sayfa yenilenince ilk istek odur ve cerezle kurtarilmalidir.
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL tanimli degil (frontend/.env.development)",
    );
  }
  return `${base}${path}`;
}

export type Transport = (request: Request) => Promise<Response>;

const networkTransport: Transport = (request) => fetch(request);
let transport: Transport = networkTransport;

// Gelistirmede sahte API bu noktadan devreye girer (src/mocks/MockProvider.tsx)
export function setTransport(next: Transport): void {
  transport = next;
}

export function resetTransport(): void {
  transport = networkTransport;
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return typeof body === "object" && body !== null && "error" in body;
}

function buildRequest(path: string, init: RequestInit): Request {
  const token = getAccessToken();
  const auth: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  // credentials: refresh cerezi yalniz /auth/* yoluna gonderilir (Path=/api/v1/auth)
  return new Request(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", ...auth, ...init.headers },
  });
}

async function parse<T>(response: Response): Promise<T> {
  const body: unknown =
    response.status === NO_CONTENT ? undefined : await response.json();
  if (response.ok) {
    return body as T;
  }
  if (isErrorEnvelope(body)) {
    throw new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body,
    );
  }
  throw new ApiError(
    response.status,
    `HTTP_${response.status}`,
    response.statusText,
    body,
  );
}

// Ayni anda gelen 401'ler tek yenilemeyi bekler: ayni cerezin iki kez kullanilmasi backend'de
// calinma belirtisi sayilabilir (docs/API.md "Rotasyon")
let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  const response = await transport(
    buildRequest("/auth/refresh", { method: "POST" }),
  );
  if (!response.ok) {
    setAccessToken(null);
    return false;
  }
  setAccessToken(((await response.json()) as TokenRead).access_token);
  return true;
}

export function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= refreshOnce().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await transport(buildRequest(path, init));
  const canRefresh =
    response.status === UNAUTHORIZED && !NO_REFRESH_PATHS.has(path);
  if (canRefresh && (await refreshAccessToken())) {
    return parse<T>(await transport(buildRequest(path, init)));
  }
  return parse<T>(response);
}

export function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, init);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return apiRequest<T>(path, init);
}
