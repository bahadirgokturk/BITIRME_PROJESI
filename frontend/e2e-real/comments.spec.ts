import { expect, test } from "@playwright/test";

import { completeTask, createTestLocation, findAssignee, openFromMenu, reportProblem, signIn, waitForTimeline, writeComment } from "./helpers";

const DESCRIPTION = "Erkek tuvaletinde sabun bitmiş";
const REPORTER_COMMENT = "Sabunluk iki gündür boş, bilginize.";
const STAFF_NOTE = "Depoda sabun azaldı, sipariş verilmeli.";
const COMPLETION_NOTE = "Sabunluk dolduruldu.";

// Yorumlar (docs/API.md "Yorum"): bildiren yazar, personel gorur ve ic not ekler; ic notu bildiren gormez, mudur gorur
test("a reporter's comment reaches staff, and an internal note stays hidden from the reporter", async ({ page, request }) => {
  const location = await createTestLocation(request, "WC");
  await signIn(page, "reporter");
  const reported = await reportProblem(page, DESCRIPTION, location.name);
  await waitForTimeline(page, "İlgili birime yönlendirildi");
  await writeComment(page, REPORTER_COMMENT);

  // Gorev kime dustuyse o tamamlar (arkada acik bildirim kalmasin), sonra yorumu gorur ve ic not yazar
  await signIn(page, await findAssignee(request, reported.number, ["cleaner", "guard"]));
  await completeTask(page, reported.number, COMPLETION_NOTE);
  const staffComments = page.getByRole("list", { name: "Yorumlar" });
  await expect(staffComments.getByText(REPORTER_COMMENT)).toBeVisible();
  await writeComment(page, STAFF_NOTE, true);
  await expect(staffComments.getByText("İç not", { exact: true })).toBeVisible();

  await signIn(page, "reporter");
  await page.getByRole("link").filter({ hasText: reported.number }).click();
  const reporterComments = page.getByRole("list", { name: "Yorumlar" });
  await expect(reporterComments.getByText(REPORTER_COMMENT)).toBeVisible();
  await expect(page.getByText(STAFF_NOTE)).toBeHidden();

  await signIn(page, "manager");
  await openFromMenu(page, "Tüm Bildirimler");
  await page.getByRole("searchbox", { name: "Bildirim ara" }).fill(reported.number);
  const rows = page.getByRole("list", { name: "Bildirimler" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await rows.getByRole("link").click();
  const managerComments = page.getByRole("list", { name: "Yorumlar" });
  await expect(managerComments.getByText(REPORTER_COMMENT)).toBeVisible();
  await expect(managerComments.getByText(STAFF_NOTE)).toBeVisible();
  await location.retire(request);
});
