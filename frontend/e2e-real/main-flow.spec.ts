import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { agentDecisions, completeTask, createTestLocation, openFromMenu, reportProblem, signIn, waitForTimeline } from "./helpers";

const DESCRIPTION = "Erkek tuvaletinde sabun bitmiş";
const DEPARTMENT = "Destek Hizmetleri Şube Müdürlüğü";
const COMPLETION_NOTE = "Sabunluk dolduruldu, lavabolar kontrol edildi.";
const TOP_RATING = "5 yıldız";
const AGENTS = ["intake", "classification", "priority", "routing", "supervisor"];
const LIFECYCLE = ["Bildiriminiz alındı", "Görevli çalışmaya başladı", "Görevli işi tamamladı", "Değerlendirmeniz alındı"];

async function expectAgentsDecided(request: APIRequestContext, caseId: string) {
  const decisions = await agentDecisions(request, caseId);
  const decisionOf = (agent: string) => decisions.find((item) => item.agent_name === agent)?.decision;
  expect(decisions.map((item) => item.agent_name)).toEqual(expect.arrayContaining(AGENTS));
  expect(decisionOf("classification")).toBe("SOAP_EMPTY");
  expect(decisionOf("supervisor")).toBe("CREATE_TASK");
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
  const rows = await findInAllCases(page, reported.number);
  await expect(rows.getByText(DEPARTMENT)).toBeVisible();

  await signIn(page, "cleaner");
  await completeTask(page, reported.number, COMPLETION_NOTE);

  await signIn(page, "reporter");
  await rateClosedCase(page, reported.number);

  await signIn(page, "manager");
  const closed = await findInAllCases(page, reported.number);
  await closed.getByRole("link").click();
  const timeline = page.getByRole("list", { name: "Zaman çizelgesi" });
  for (const label of LIFECYCLE) {
    await expect(timeline.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await location.retire(request);
});
