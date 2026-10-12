import { expect, test } from "@playwright/test";

import { completeTask, createTestLocation, openFromMenu, reportProblem, signIn, waitForTimeline, type ReportedCase, type TestLocation } from "./helpers";

const DESCRIPTION = "Priz kıvılcım çıkarıyor, yanık kokusu var";
const COMPLETION_NOTE = "Priz değiştirildi, hat kontrol edildi.";

// Iki senaryo ayni bildirimi kullanir: ikincisi onu kapatir, boylece arkada acik bildirim kalmaz
test.describe.configure({ mode: "serial" });
let reported: ReportedCase;
let location: TestLocation;

// Alternatif 1: baskasinin bildirimi "yok" gibi gorunur (IDOR, docs/TESTING.md "Guvenlik")
test("a reporter cannot open another reporter's case", async ({ page, request }) => {
  location = await createTestLocation(request, "ROOM");
  await signIn(page, "reporter");
  reported = await reportProblem(page, DESCRIPTION, location.name);
  await waitForTimeline(page, "Bildiriminiz incelendi");

  await signIn(page, "otherReporter");
  await page.goto(`/cases/${reported.id}`);
  await expect(page.getByText("Kayıt bulunamadı")).toBeVisible();
  await expect(page.getByText(DESCRIPTION)).toBeHidden();
});

// Alternatif 2: guvenlik riski tasiyan bildirimi agent'lar kendileri atamaz, mudure birakir
test("a safety problem waits for the manager, who sees the AI reasoning and assigns it from the case screen", async ({ page, request }) => {
  await signIn(page, "manager");
  await openFromMenu(page, "İnceleme Kuyruğu");
  const card = page.getByRole("article").filter({ hasText: reported.number });
  await expect(card.getByText("Yöneticiye iletildi")).toBeVisible();
  await expect(card.getByText("Kritik", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Yapay zekâ gerekçesi" }).click();
  await expect(card.getByRole("list", { name: "Yapay zekâ kararları" }).getByRole("listitem").first()).toBeVisible();

  // Karar bildirimin kendi ekranindan verilir (kuyruktaki kartla ayni dugmeler)
  await openFromMenu(page, "Tüm Bildirimler");
  await page.getByRole("searchbox", { name: "Bildirim ara" }).fill(reported.number);
  // Arama sonucu gelene kadar listede baska bildirimler de durur
  const rows = page.getByRole("list", { name: "Bildirimler" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await rows.getByRole("link").click();
  const decision = page.getByRole("region", { name: "Bu bildirim kararınızı bekliyor" });
  await expect(decision.getByText("Neden burada?")).toBeVisible();
  await decision.getByRole("button", { name: "Onayla ve ata" }).click();
  await expect(page.getByRole("status").filter({ hasText: "atandı." })).toBeVisible();
  await expect(decision).toBeHidden();
  await expect(page.getByRole("list", { name: "Durum" }).getByText("Müdüre yükseltildi")).toBeHidden();

  await signIn(page, "technician");
  await completeTask(page, reported.number, COMPLETION_NOTE);
  await location.retire(request);
});
