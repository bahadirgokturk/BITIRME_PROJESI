import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { createQueryClient } from "@/lib/queryClient";
import { CASES } from "@/mocks/caseFixtures";
import { server } from "@/mocks/node";

import { CaseDetail } from "./CaseDetail";

type CaseRead = components["schemas"]["CaseRead"];

const MS_PER_HOUR = 3_600_000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * MS_PER_HOUR).toISOString();

const WAITING = CASES.find((item) => item.status === "NEEDS_INFO")!;
const CLOSED: CaseRead = { ...CASES.find((item) => item.status === "CLOSED")!, closed_at: hoursAgo(2) };

// Sunucudaki bildirim: islem sonrasi degisen hali de ayni yerden okunur
function serveCase(initial: CaseRead) {
  const state = { current: initial };
  server.use(http.get(apiUrl(`/cases/${initial.id}`), () => HttpResponse.json(state.current)));
  return state;
}

function conflict(path: string, message: string) {
  server.use(
    http.post(apiUrl(path), () =>
      HttpResponse.json({ error: { code: "CONFLICT", message, details: {} } }, { status: 409 }),
    ),
  );
}

function renderDetail(caseId: number) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CaseDetail caseId={String(caseId)} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("answering an information request", () => {
  it("sends the reply and shows the case as received again", async () => {
    const state = serveCase(WAITING);
    let sent: unknown;
    server.use(
      http.post(apiUrl(`/cases/${WAITING.id}/info`), async ({ request }) => {
        sent = await request.json();
        state.current = { ...WAITING, status: "ANALYZING", info_request: null };
        return HttpResponse.json(state.current);
      }),
    );
    const user = renderDetail(WAITING.id);

    const send = await screen.findByRole("button", { name: "Yanıtı gönder" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Yanıtın"), "Arka sıralardaki prizin yanında.");
    await user.click(send);

    await waitFor(() => expect(sent).toEqual({ body: "Arka sıralardaki prizin yanında." }));
    expect((await screen.findByText("Alındı")).closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByLabelText("Yanıtın")).not.toBeInTheDocument();
  });

  it("shows the backend message when the reply is rejected", async () => {
    serveCase(WAITING);
    conflict(`/cases/${WAITING.id}/info`, "Bildirim bu durumdan istenen duruma geçirilemez.");
    const user = renderDetail(WAITING.id);

    await user.type(await screen.findByLabelText("Yanıtın"), "Prizin yanında.");
    await user.click(screen.getByRole("button", { name: "Yanıtı gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bildirim bu durumdan istenen duruma geçirilemez.");
    expect(screen.getByLabelText("Yanıtın")).toHaveValue("Prizin yanında.");
  });
});

describe("rating a closed case", () => {
  it("sends the chosen stars and thanks the reporter", async () => {
    const state = serveCase(CLOSED);
    let sent: unknown;
    server.use(
      http.post(apiUrl(`/cases/${CLOSED.id}/feedback`), async ({ request }) => {
        sent = await request.json();
        state.current = { ...CLOSED, satisfaction_rating: 4 };
        return HttpResponse.json(state.current);
      }),
    );
    const user = renderDetail(CLOSED.id);

    const send = await screen.findByRole("button", { name: "Değerlendirmeyi gönder" });
    expect(send).toBeDisabled();
    await user.click(within(screen.getByRole("radiogroup", { name: "Puan" })).getByRole("radio", { name: "4 yıldız" }));
    expect(screen.getByText("4 / 5 · İyi")).toBeInTheDocument();
    await user.click(send);

    await waitFor(() => expect(sent).toEqual({ rating: 4, comment: null }));
    expect(await screen.findByText("Değerlendirmen alındı")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5 üzerinden 4 yıldız" })).toBeInTheDocument();
  });

  it("hides rating and reopening once the 72 hour window has passed", async () => {
    serveCase({ ...CLOSED, closed_at: hoursAgo(73) });
    renderDetail(CLOSED.id);

    expect(await screen.findByRole("heading", { name: CLOSED.title })).toBeInTheDocument();
    expect(screen.queryByText("Sorun çözüldü mü?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sorun devam ediyor" })).not.toBeInTheDocument();
  });
});

describe("reopening a closed case", () => {
  it("asks for a reason and reopens the case", async () => {
    const state = serveCase(CLOSED);
    let sent: unknown;
    server.use(
      http.post(apiUrl(`/cases/${CLOSED.id}/reopen`), async ({ request }) => {
        sent = await request.json();
        state.current = { ...CLOSED, status: "REOPENED", closed_at: null, reopened_count: 1 };
        return HttpResponse.json(state.current);
      }),
    );
    const user = renderDetail(CLOSED.id);

    await user.click(await screen.findByRole("button", { name: "Sorun devam ediyor" }));
    const dialog = await screen.findByRole("dialog", { name: "Sorun devam ediyor" });
    const confirm = within(dialog).getByRole("button", { name: "Yeniden aç" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Neden yeniden açıyorsun?"), "Ertesi gün yine taşmıştı.");
    await user.click(confirm);

    await waitFor(() => expect(sent).toEqual({ reason: "Ertesi gün yine taşmıştı." }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await screen.findByText("Alındı")).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("keeps the dialog open and shows why reopening failed", async () => {
    serveCase(CLOSED);
    conflict(`/cases/${CLOSED.id}/reopen`, "Bildirim kapandıktan sonraki 72 saat içinde yeniden açılabilir.");
    const user = renderDetail(CLOSED.id);

    await user.click(await screen.findByRole("button", { name: "Sorun devam ediyor" }));
    const dialog = await screen.findByRole("dialog", { name: "Sorun devam ediyor" });
    await user.type(within(dialog).getByLabelText("Neden yeniden açıyorsun?"), "Hâlâ taşıyor.");
    await user.click(within(dialog).getByRole("button", { name: "Yeniden aç" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("72 saat içinde yeniden açılabilir.");
  });
});
