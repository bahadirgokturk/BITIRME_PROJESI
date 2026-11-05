// Staging/production (docs/DEPLOYMENT.md 1.1): frontend Vercel'de, backend Render'da. Tarayici
// yalniz Vercel adresini gorur; /api/v1 istekleri Next tarafindan backend'e aktarilir. Boylece giris
// cerezi (SameSite=Strict, httpOnly) ayni siteden gelir ve tarayici onu gonderir.
// Yerelde BACKEND_ORIGIN tanimsizdir: istemci dogrudan NEXT_PUBLIC_API_URL'e gider.

export interface Rewrite {
  source: string;
  destination: string;
}

const API_PATH = "/api/v1/:path*";

export function apiRewrites(backendOrigin: string | undefined): Rewrite[] {
  if (!backendOrigin) {
    return [];
  }
  const origin = backendOrigin.replace(/\/+$/, "");
  return [{ source: API_PATH, destination: `${origin}${API_PATH}` }];
}
