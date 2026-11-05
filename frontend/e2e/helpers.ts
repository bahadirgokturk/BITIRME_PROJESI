import { expect, type Page } from "@playwright/test";

import { MOCK_PASSWORD, USERS, type Role } from "../src/mocks/fixtures";

// Sahte API giris yapan kullanicinin rolunu kullanir (mocks/handlers.ts); sayfa yenilenirse varsayilan role doner.
// Bu yuzden senaryolar giristen sonra yalniz uygulama ici gezinir (page.goto ile sayfa yenilemez).
export async function signIn(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(USERS[role].email);
  await page.getByLabel("Parola").fill(MOCK_PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

// Telefonda menu ust cubuktaki dugmeyle acilir; masaustunde kenar menusu hep gorunur.
// Giristen hemen sonra sayfa henuz cizilmemis olabilir: once dugmenin ya da menunun gorunmesi beklenir.
export async function openFromMenu(page: Page, label: string) {
  const menuButton = page.getByRole("button", { name: "Menüyü aç" });
  const menu = page.getByRole("navigation", { name: "Ana menü" });
  await expect(menuButton.or(menu).first()).toBeVisible();
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await menu.getByRole("link", { name: label, exact: true }).click();
}
