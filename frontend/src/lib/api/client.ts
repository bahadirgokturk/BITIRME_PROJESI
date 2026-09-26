// Backend REST istemcisi. Hata yutulmaz: her basarisiz yanit ApiError olarak firlatilir.
import type { components } from "@/lib/api/types";

type ErrorEnvelope = components["schemas"]["ErrorRead"];

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
    throw new Error("NEXT_PUBLIC_API_URL tanimli degil (frontend/.env.development)");
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

export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = new Request(apiUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  const response = await transport(request);
  const body: unknown = await response.json();
  if (response.ok) {
    return body as T;
  }
  if (isErrorEnvelope(body)) {
    throw new ApiError(response.status, body.error.code, body.error.message, body);
  }
  throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText, body);
}
