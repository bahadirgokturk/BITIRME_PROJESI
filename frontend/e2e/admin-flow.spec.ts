import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

// Yonetici senaryosu: giris -> Yonetim > Kullanicilar -> personel ekle -> listede gor
test("an admin adds a staff member to a department", async ({ page }) => {
  await signIn(page, "ADMIN");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Kullanıcılar" })).toBeVisible();

  await page.getByRole("button", { name: "Kullanıcı ekle" }).click();
  const panel = page.getByRole("dialog", { name: "Kullanıcı ekle" });
  await panel.getByLabel("Ad soyad", { exact: true }).fill("Elif Arslan");
  await panel.getByLabel("E-posta", { exact: true }).fill("elif.arslan@example.edu.tr");
  await panel.getByLabel("Rol", { exact: true }).selectOption({ label: "Personel" });
  await panel.getByLabel("Birim", { exact: true }).selectOption({ label: "Destek Hizmetleri Şube Müdürlüğü" });
  await panel.getByLabel("Parola", { exact: true }).fill("guclu-parola-1");
  await panel.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Elif Arslan eklendi." })).toBeVisible();
  const row = page.getByRole("row", { name: /Elif Arslan/ });
  await expect(row.getByText("Destek Hizmetleri Şube Müdürlüğü")).toBeVisible();
});

// Sekmeler arasi gecis ve konum agaci: Birimler -> Konumlar -> bir dali ac -> ara
test("an admin moves between the admin tabs and browses the location tree", async ({ page }) => {
  await signIn(page, "ADMIN");
  const tabs = page.getByRole("navigation", { name: "Yönetim bölümleri" });

  await tabs.getByRole("link", { name: "Birimler" }).click();
  await expect(page.getByRole("heading", { name: "Birimler" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Beslenme Hizmetleri/ })).toBeVisible();

  await tabs.getByRole("link", { name: "Konumlar" }).click();
  await expect(page.getByRole("heading", { name: "Konumlar" })).toBeVisible();
  await page.getByRole("button", { name: "B Blok altını aç" }).click();
  await expect(page.getByRole("listitem", { name: "B Blok 2. Kat", exact: true })).toBeVisible();

  await page.getByRole("searchbox", { name: "Konum ara" }).fill("amfi");
  await expect(page.getByRole("listitem", { name: "B201 Amfi" })).toContainText("Merkez Kampüs › B Blok › B Blok 2. Kat");
});
