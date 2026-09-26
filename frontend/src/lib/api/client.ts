// Backend REST istemcisi. Hata yutulmaz: her basarisiz yanit ApiError olarak firlatilir.

interface ErrorEnvelope {
  error: { code: string; message: string; details: Record<string, unknown> };
}

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

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL tanimli degil (.env.example)");
  }
  return url;
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return typeof body === "object" && body !== null && "error" in body;
}

export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  const body: unknown = await response.json();
  if (response.ok) {
    return body as T;
  }
  if (isErrorEnvelope(body)) {
    throw new ApiError(response.status, body.error.code, body.error.message, body);
  }
  throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText, body);
}
