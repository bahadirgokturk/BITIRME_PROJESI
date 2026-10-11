import { defineConfig, devices } from "@playwright/test";

// Backend'in CORS izni yalniz bu adrese verilir (.env CORS_ORIGINS); baska portta istekler tarayicida engellenir
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
// Ilk kosuda uretim paketi derlenir (next build); yavas makinede dakikalar surebilir
const SERVER_START_TIMEOUT_MS = 240_000;
// Senaryo dort kez giris yapar ve agent hattini bekler; varsayilan 30 sn yetmez
const TEST_TIMEOUT_MS = 120_000;

// Gercek backend ile uctan uca senaryolar (docs/TESTING.md "E2E Ana Senaryo"): agent'lar gercekten karar verir.
// Once backend + seed calismali: docker compose up -d, alembic upgrade head, python -m seeds.run --demo.
// Senaryolar veritabanina yazar ve ayni binadaki acik bildirimler "tekrar" sayilabilir; bu yuzden tek tek kosar.
export default defineConfig({
  testDir: "./e2e-real",
  timeout: TEST_TIMEOUT_MS,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  // Bildiren ve personel isini telefondan yapar; tek boyut yeter (ekran yerlesimi sahte API senaryolarinda denenir)
  projects: [{ name: "telefon", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/login`,
    // 3000'de sahte API ile calisan gelistirme sunucusu varsa onu kullanmak testi yaniltir: once kapatilmali
    reuseExistingServer: false,
    timeout: SERVER_START_TIMEOUT_MS,
    env: { NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_API_MOCKING: "disabled" },
  },
});
