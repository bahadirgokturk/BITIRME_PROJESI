import { defineConfig, devices } from "@playwright/test";

// Uctan uca testler kendi sunucusunu ayri bir portta acar; gelistirme sunucusu (3000) calisirken de kosabilir
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
// Ilk kosuda uretim paketi derlenir (next build); yavas makinede dakikalar surebilir
const SERVER_START_TIMEOUT_MS = 240_000;

// Ana senaryo sahte API ile kosar (docs/PROJECT_PLAN.md E7-1): backend ve Docker gerekmez, CI'da da calisir.
// Ortam degiskenleri .env.local'in onune gecer; sahte oturum "bildirim yapan" rolundedir.
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "telefon", use: { ...devices["Pixel 7"] } },
    { name: "masaustu", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: SERVER_START_TIMEOUT_MS,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:8000/api/v1",
      NEXT_PUBLIC_API_MOCKING: "enabled",
      NEXT_PUBLIC_MOCK_ROLE: "REPORTER",
    },
  },
});
