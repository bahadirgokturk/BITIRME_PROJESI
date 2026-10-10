import { expect, test } from "@playwright/test";

import { openFromMenu, signIn } from "./helpers";

// mocks/managerHandlers.ts kuyrugundaki guvenlik bildirimi
const SAFETY_CASE = "Laboratuvarda priz kıvılcım çıkarıyor";

// Mudur senaryosu: giris -> Genel Bakis -> Inceleme Kuyrugu -> yapay zeka gerekcesini gor -> onayla ve ata
test("a manager reviews a case the AI escalated and assigns it", async ({ page }) => {
  await signIn(page, "MANAGER");
  await expect(page).toHaveURL(/\/manager\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Genel Bakış" })).toBeVisible();

  await openFromMenu(page, "İnceleme Kuyruğu");
  await expect(page.getByRole("heading", { name: "İnceleme Kuyruğu" })).toBeVisible();
  const card = page.getByRole("article", { name: SAFETY_CASE });
  await expect(card.getByText("Yöneticiye iletildi")).toBeVisible();

  await card.getByRole("button", { name: "Yapay zekâ gerekçesi" }).click();
  await expect(card.getByRole("list", { name: "Yapay zekâ kararları" })).toBeVisible();

  await card.getByRole("button", { name: "Onayla ve ata" }).click();
  await expect(page.getByRole("status").filter({ hasText: "atandı." })).toBeVisible();
  await expect(card).toBeHidden();
});

test("a manager finds a case in the full list by searching", async ({ page }) => {
  await signIn(page, "MANAGER");
  await expect(page.getByRole("heading", { name: "Genel Bakış" })).toBeVisible();

  await openFromMenu(page, "Tüm Bildirimler");
  const list = page.getByRole("list", { name: "Bildirimler" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  const firstNumber = await list.getByRole("listitem").first().getByText(/^CASE-/).innerText();

  await page.getByRole("searchbox", { name: "Bildirim ara" }).fill(firstNumber);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByText(firstNumber)).toBeVisible();
});
