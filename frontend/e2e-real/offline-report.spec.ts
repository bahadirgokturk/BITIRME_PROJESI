import { expect, test } from "@playwright/test";

import { createTestLocation, openFromMenu, signIn } from "./helpers";

const DESCRIPTION = "Bodrum katta internet yokken yazılan bildirim: lavabo su sızdırıyor";
// Baglanti gelince sunucu en gec 10 sn'de bir yoklanir (OfflineBanner); gonderme ve liste icin pay birakilir
const SYNC_TIMEOUT_MS = 30_000;

// Gercek tarayicinin IndexedDB'si: birim testleri bellek ici depoyla calisir, kayit burada denenir
test("a report written without internet is saved and goes out by itself when the connection is back", async ({
  page,
  context,
  request,
}) => {
  const location = await createTestLocation(request, "WC");
  try {
    await signIn(page, "reporter");
    await openFromMenu(page, "Bildirim Yap");
    await page.getByLabel("Ne oldu?").fill(DESCRIPTION);
    await page.getByRole("searchbox", { name: "Konum" }).fill(location.name);
    await page.getByRole("button", { name: location.name, exact: true }).click();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Kaydet, internet gelince gönder" }).click();
    await expect(page.getByRole("heading", { name: "Bildiriminiz kaydedildi" })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("link", { name: "Bildirimlerim" }).first().click();
    await expect(page.getByText(/^Bekleyen bildirimin gönderildi: CASE-/)).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
    await expect(page.getByRole("list", { name: "Bildirimleriniz" }).getByText(DESCRIPTION.slice(0, 40))).toBeVisible();
  } finally {
    await location.retire(request);
  }
});
