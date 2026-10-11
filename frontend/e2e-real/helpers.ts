import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
const PASSWORD_KEY = "SEED_DEMO_PASSWORD";
const ANALYSIS_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 5_000;
const TASK_PAGE_SIZE = 100;

// Demo hesaplari (backend/seeds/demo/users.yaml)
export const ACCOUNTS = {
  reporter: "ogrenci@kampus.example.com",
  otherReporter: "akademisyen@kampus.example.com",
  cleaner: "temizlik@kampus.example.com",
  guard: "guvenlik@kampus.example.com",
  technician: "teknisyen@kampus.example.com",
  manager: "mudur.destek@kampus.example.com",
  admin: "admin@kampus.example.com",
} as const;

export type Account = keyof typeof ACCOUNTS;

// Parola koda yazilmaz: ortam degiskeninden, yoksa depo kokundeki .env dosyasindan okunur
function demoPassword(): string {
  const fromEnv = process.env[PASSWORD_KEY];
  if (fromEnv) {
    return fromEnv;
  }
  const lines = readFileSync(path.resolve(process.cwd(), "..", ".env"), "utf8").split(/\r?\n/);
  const line = lines.find((entry) => entry.startsWith(`${PASSWORD_KEY}=`));
  if (!line) {
    throw new Error(`${PASSWORD_KEY} tanimli degil (.env ya da ortam degiskeni)`);
  }
  return line.slice(PASSWORD_KEY.length + 1).trim();
}

// Onceki oturumun cerezi silinir; yoksa giris sayfasi eski kullaniciyi geri yukler
export async function signIn(page: Page, account: Account) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(ACCOUNTS[account]);
  await page.getByLabel("Parola").fill(demoPassword());
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Telefonda menu ust cubuktaki dugmeyle acilir. Giristen hemen sonra sayfa henuz cizilmemis olabilir:
// once dugmenin ya da menunun gorunmesi beklenir, yoksa dugme "yok" sanilip menu hic acilmaz.
export async function openFromMenu(page: Page, label: string) {
  const menuButton = page.getByRole("button", { name: "Menüyü aç" });
  const menu = page.getByRole("navigation", { name: "Ana menü" });
  await expect(menuButton.or(menu).first()).toBeVisible();
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await menu.getByRole("link", { name: label, exact: true }).click();
}

export interface ReportedCase {
  id: string;
  number: string;
}

// Bildirim formunu doldurur, gonderir ve bildirimin detay sayfasini acar
export async function reportProblem(page: Page, description: string, location: string): Promise<ReportedCase> {
  await openFromMenu(page, "Bildirim Yap");
  await page.getByLabel("Ne oldu?").fill(description);
  await page.getByRole("searchbox", { name: "Konum" }).fill(location);
  await page.getByRole("button", { name: location, exact: true }).click();
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("heading", { name: "Bildiriminiz alındı, inceleniyor" })).toBeVisible();
  const number = await page.getByText("Bildirim numaranız").locator("xpath=following-sibling::p").innerText();

  await page.getByRole("link", { name: "Bildirimlerim" }).first().click();
  await page.getByRole("link").filter({ hasText: number }).click();
  await expect(page).toHaveURL(/\/cases\/\d+$/);
  return { id: page.url().split("/").at(-1) ?? "", number };
}

// Agent hatti arka planda calisir: beklenen olay zaman cizelgesine dusene kadar sayfa yenilenir
export async function waitForTimeline(page: Page, label: string) {
  const timeline = page.getByRole("list", { name: "Zaman çizelgesi" });
  await expect(async () => {
    await page.reload();
    await expect(timeline.getByText(label).first()).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  }).toPass({ timeout: ANALYSIS_TIMEOUT_MS });
}

// 1x1 piksellik gecerli PNG: kanit fotografi (backend dosya icerigini de dogrular)
const EVIDENCE_PHOTO = {
  name: "kanit.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

// Personel gorevi kabul eder, baslatir, not ve fotografla tamamlar. Fotograf olmazsa Resolution Agent
// hemen biten isi supheli bulur ve bildirim kapanmaz; acik kalan bildirim sonraki kosuda "tekrar" sayilir.
export async function completeTask(page: Page, caseNumber: string, note: string) {
  await expect(page.getByRole("heading", { name: "Görevlerim" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: caseNumber }).click();
  await page.getByRole("button", { name: "Kabul et" }).click();
  await page.getByRole("button", { name: "Başlat" }).click();
  await page.getByRole("button", { name: "Tamamla" }).click();
  const panel = page.getByRole("dialog", { name: "Görevi tamamla" });
  await panel.getByLabel("Not (isteğe bağlı)").fill(note);
  await panel.getByLabel("Kanıt fotoğrafı (isteğe bağlı)").setInputFiles(EVIDENCE_PHOTO);
  await panel.getByRole("button", { name: "Tamamla" }).click();
  await expect(page.getByRole("heading", { name: "Görev tamamlandı" })).toBeVisible();
}

async function apiHeaders(request: APIRequestContext, account: Account) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: ACCOUNTS[account], password: demoPassword() },
  });
  expect(login.ok()).toBe(true);
  const { access_token: token } = (await login.json()) as { access_token: string };
  return { Authorization: `Bearer ${token}` };
}

interface LocationRecord {
  id: number;
  kind: string;
  name: string;
}

export interface TestLocation {
  name: string;
  // Kosu bitince pasife alir: bildirim formunda ve konum aramasinda gorunmez
  retire: (request: APIRequestContext) => Promise<void>;
}

// Her kosu kendi binasini acar. Duplicate Agent ayni binadaki acik bildirimlere bakar (son 24 saat):
// sabit bir konum kullanilsa yarida kalan kosu ya da elle acilmis bir bildirim sonraki kosuyu "tekrar" yapardi.
export async function createTestLocation(request: APIRequestContext, kind: "WC" | "ROOM"): Promise<TestLocation> {
  const headers = await apiHeaders(request, "admin");
  const stamp = Date.now().toString(36).toUpperCase();
  const list = await request.get(`${API_URL}/admin/locations?page_size=200`, { headers });
  const { items } = (await list.json()) as { items: LocationRecord[] };
  const campus = items.find((item) => item.kind === "CAMPUS");
  expect(campus, "seed yuklu olmali: python -m seeds.run --demo").toBeDefined();

  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_URL}/admin/locations`, { headers, data });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as LocationRecord;
  };
  const building = await create({ parent_id: campus?.id, kind: "BUILDING", code: `E2E-${stamp}`, name: `Deneme Binası ${stamp}` });
  const room = await create({ parent_id: building.id, kind, code: `E2E-${stamp}-1`, name: `Deneme Odası ${stamp}` });

  const retire = async (current: APIRequestContext) => {
    for (const id of [room.id, building.id]) {
      await current.patch(`${API_URL}/admin/locations/${id}`, { headers, data: { is_active: false } });
    }
  };
  return { name: room.name, retire };
}

// Routing Agent gorevi is yuku en az olan personele verir; kim oldugu veritabaninin o anki durumuna baglidir.
// Adaylarin gorev listesine bakilir, bildirimi gorev olarak goren ilk hesap doner.
export async function findAssignee(request: APIRequestContext, caseNumber: string, candidates: Account[]): Promise<Account> {
  for (const candidate of candidates) {
    const headers = await apiHeaders(request, candidate);
    const response = await request.get(`${API_URL}/tasks/mine?page_size=${TASK_PAGE_SIZE}`, { headers });
    expect(response.ok(), await response.text()).toBe(true);
    const { items } = (await response.json()) as { items: { case_number: string }[] };
    if (items.some((task) => task.case_number === caseNumber)) {
      return candidate;
    }
  }
  throw new Error(`${caseNumber} icin gorev hicbir adayda yok: ${candidates.join(", ")}`);
}

interface AgentDecision {
  agent_name: string;
  decision: string;
}

// Otomatik atanan bildirimde agent kararlarini gosteren ekran henuz yok; kararlar API'den dogrulanir
export async function agentDecisions(request: APIRequestContext, caseId: string): Promise<AgentDecision[]> {
  const headers = await apiHeaders(request, "manager");
  const response = await request.get(`${API_URL}/cases/${caseId}/decisions`, { headers });
  expect(response.ok()).toBe(true);
  return (await response.json()) as AgentDecision[];
}
