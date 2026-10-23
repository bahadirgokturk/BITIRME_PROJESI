import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { agentDecisions, completeTask, createTestLocation, findAssignee, openFromMenu, reportProblem, signIn, waitForTimeline } from "./helpers";

const DESCRIPTION = "Erkek tuvaletinde sabun bitmiş";
const DEPARTMENT = "Destek Hizmetleri Şube Müdürlüğü";
const COMPLETION_NOTE = "Sabunluk dolduruldu, lavabolar kontrol edildi.";
const TOP_RATING = "5 yıldız";
// Uygun personel bossa dogrudan ona (AUTO_ASSIGN), degilse birim havuzuna (CREATE_TASK): ikisi de insansiz karar
const AUTOMATED = ["AUTO_ASSIGN", "CREATE_TASK"];
const AGENTS = ["intake", "classification", "priority", "routing", "supervisor"];
// Mudurun detay ekranindaki adlar (lib/managerCase.ts); bildiren ayni olaylari sade haliyle gorur
const LIFECYCLE = ["Bildirim açıldı", "Çalışma başladı", "İş tamamlandı", "Bildiren 5 puan verdi"];
const AI_STEPS = ["Sınıflandırma", "Öncelik", "Yönlendirme", "Karar"];

async function expectAgentsDecided(request: APIRequestContext, caseId: string) {
  const decisions = await agentDecisions(request, caseId);
  const decisionOf = (agent: string) => decisions.find((item) => item.agent_name === agent)?.decision;
  expect(decisions.map((item) => item.agent_name)).toEqual(expect.arrayContaining(AGENTS));
  expect(decisionOf("classification")).toBe("SOAP_EMPTY");
  expect(AUTOMATED).toContain(decisionOf("supervisor"));
}

const CLOSED_COUNT = /(\d+) bildirim kapandı/;

// Genel Bakis'taki grafik basligi donemde kapanan bildirim sayisini soyler ("12 bildirim acildi, 9 bildirim kapandi")
async function closedOnDashboard(page: Page): Promise<number> {
  await openFromMenu(page, "Genel Bakış");
  const headline = page.getByRole("heading", { name: CLOSED_COUNT });
  await expect(headline).toBeVisible();
  return Number(CLOSED_COUNT.exec(await headline.innerText())?.[1]);
}

async function findInAllCases(page: Page, caseNumber: string) {
  await openFromMenu(page, "Tüm Bildirimler");
  await page.getByRole("searchbox", { name: "Bildirim ara" }).fill(caseNumber);
  const rows = page.getByRole("list", { name: "Bildirimler" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  return rows;
}

async function rateClosedCase(page: Page, caseNumber: string) {
  await page.getByRole("link").filter({ hasText: caseNumber }).click();
  await expect(page.getByRole("list", { name: "Zaman çizelgesi" }).getByText("Bildiriminiz kapatıldı")).toBeVisible();
  // Radyo dugmesi gorsel olarak gizli, yildiz onun etiketi: dogrudan isaretlenir
  await page.getByRole("radio", { name: TOP_RATING }).check({ force: true });
  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(page.getByRole("heading", { name: "Değerlendirmen alındı" })).toBeVisible();
}

// Ana senaryo (docs/TESTING.md): bildir -> agent'lar atar -> personel tamamlar -> kapanir -> bildiren puanlar
test("a reported problem is assigned by the agents, done by staff, closed and rated", async ({ page, request }) => {
  const location = await createTestLocation(request, "WC");
  await signIn(page, "reporter");
  const reported = await reportProblem(page, DESCRIPTION, location.name);
  await waitForTimeline(page, "İlgili birime yönlendirildi");
  await expectAgentsDecided(request, reported.id);

  await signIn(page, "manager");
  const closedBefore = await closedOnDashboard(page);
  const rows = await findInAllCases(page, reported.number);
  await expect(rows.getByText(DEPARTMENT)).toBeVisible();

  // Destek Hizmetleri'nin iki personeli var; gorev hangisine dustuyse o tamamlar
  await signIn(page, await findAssignee(request, reported.number, ["cleaner", "guard"]));
  await completeTask(page, reported.number, COMPLETION_NOTE);

  await signIn(page, "reporter");
  await rateClosedCase(page, reported.number);

  await signIn(page, "manager");
  expect(await closedOnDashboard(page)).toBe(closedBefore + 1);
  const closed = await findInAllCases(page, reported.number);
  await closed.getByRole("link").click();
  // Mudur kararlarin gerekcesini ekranda da gorur (yalniz API'de degil)
  const decisions = page.getByRole("list", { name: "Yapay zekâ kararları" });
  await expect(decisions.getByText("Sabun bitti")).toBeVisible();
  for (const step of AI_STEPS) {
    await expect(decisions.getByText(step, { exact: true })).toBeVisible();
  }
  // Uzun cizelgede once son adimlar gelir; butun yasam dongusu icin oncekiler acilir
  await page.getByRole("button", { name: /önceki adımı göster/ }).click();
  const timeline = page.getByRole("list", { name: "Zaman çizelgesi" });
  for (const label of LIFECYCLE) {
    await expect(timeline.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await location.retire(request);
});
