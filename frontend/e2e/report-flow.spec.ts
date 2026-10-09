import { expect, test, type Page } from "@playwright/test";

import { MOCK_PASSWORD, USERS } from "../src/mocks/fixtures";

const DESCRIPTION = "B blok 2. kat erkek tuvalette sabun bitmiş";

// Telefonda menu ust cubuktaki dugmeyle acilir; masaustunde kenar menusu hep gorunur
async function openFromMenu(page: Page, label: string) {
  const menuButton = page.getByRole("button", { name: "Menüyü aç" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: label, exact: true }).click();
}

// Ana senaryo (docs/PROJECT_PLAN.md E7-1): giris yap -> bildirim olustur -> Bildirimlerim'de gor
test("a reporter signs in, reports a problem and finds it in their cases", async ({ page }) => {
  // Sahte API oturumu her zaman yeniler; bu yuzden giris sayfasi dogrudan acilir (cikis yapmis kullanici gibi)
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(USERS.REPORTER.email);
  await page.getByLabel("Parola").fill(MOCK_PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/my-cases$/);
  await expect(page.getByRole("heading", { name: "Bildirimlerim" })).toBeVisible();

  await openFromMenu(page, "Bildirim Yap");
  await page.getByLabel("Ne oldu?").fill(DESCRIPTION);
  await page.getByRole("searchbox", { name: "Konum" }).fill("b2 wc");
  await page.getByRole("button", { name: "B Blok 2. Kat Erkek WC" }).click();
  await page.getByRole("button", { name: "Gönder" }).click();

  await expect(page.getByRole("heading", { name: "Bildiriminiz alındı, inceleniyor" })).toBeVisible();
  const caseNumber = await page.getByText("Bildirim numaranız").locator("xpath=following-sibling::p").innerText();
  expect(caseNumber).not.toBe("");

  await page.getByRole("link", { name: "Bildirimlerim" }).first().click();
  await expect(page.getByRole("heading", { name: "Bildirimlerim" })).toBeVisible();
  await expect(page.getByText(caseNumber)).toBeVisible();
});

test("a wrong password shows the backend's message and stays on the login page", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("E-posta").fill(USERS.REPORTER.email);
  await page.getByLabel("Parola").fill("yanlis-parola");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page.getByText("E-posta veya parola hatalı.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
