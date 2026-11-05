// Access token YALNIZ bellekte tutulur: localStorage/sessionStorage'a yazilmaz, boylece sayfaya
// sizan bir script (XSS) kalici olarak calamaz. Sayfa yenilenince kaybolur; HttpOnly refresh
// cerezi ile sessizce yenisi alinir (src/lib/api/client.ts).
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
