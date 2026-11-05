import { expect, test } from "@playwright/test";

import { USERS } from "../src/mocks/fixtures";

import { openFromMenu, signIn } from "./helpers";

const DESCRIPTION = "B blok 2. kat erkek tuvalette sabun bitmiş";

// Ana senaryo (docs/PROJECT_PLAN.md E7-1): giris yap -> bildirim olustur -> Bildirimlerim'de gor
test("a reporter signs in, reports a problem and finds it in their cases", async ({ page }) => {
  await signIn(page, "REPORTER");
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
