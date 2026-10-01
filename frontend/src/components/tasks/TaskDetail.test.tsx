import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { EVIDENCE_MAX_BYTES } from "@/lib/tasks";
import { server } from "@/mocks/node";
import { TASKS } from "@/mocks/taskFixtures";

import { TaskDetail } from "./TaskDetail";

// Her test ayri bir gorevle calisir: sahte API durumu dosya boyunca saklar
const PENDING = TASKS.filter((item) => item.status === "PENDING");
const ACCEPTED = TASKS.find((item) => item.status === "ACCEPTED")!;
const IN_PROGRESS = TASKS.find((item) => item.status === "IN_PROGRESS")!;

// jsdom'da createObjectURL yok (tum tarayicilarda var)
beforeAll(() => {
  URL.createObjectURL = () => "blob:kanit";
});

function renderDetail(taskId: number) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TaskDetail taskId={String(taskId)} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("TaskDetail", () => {
  it("shows the location as the title with the job details", async () => {
    renderDetail(PENDING[0]!.id);

    expect(await screen.findByRole("heading", { level: 1, name: "B Blok 2. Kat Erkek WC" })).toBeInTheDocument();
    expect(screen.getByText("CASE-000101")).toBeInTheDocument();
    expect(screen.getByText("Tuvalette sabun bitmiş")).toBeInTheDocument();
    expect(screen.getByText("Destek Hizmetleri Şube Müdürlüğü")).toBeInTheDocument();
    expect(screen.getByText("Düşük")).toBeInTheDocument();
  });

  it("walks a pending task: accept, then start", async () => {
    const user = renderDetail(PENDING[0]!.id);

    await user.click(await screen.findByRole("button", { name: "Kabul et" }));

    await user.click(await screen.findByRole("button", { name: "Başlat" }));

    expect(await screen.findByRole("button", { name: "Tamamla" })).toBeInTheDocument();
    expect(screen.getByText("Çalışılıyor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reddet" })).not.toBeInTheDocument();
  });

  it("uploads the evidence photos before completing", async () => {
    // Onceki test bu gorevi IN_PROGRESS durumuna getirdi
    const task = PENDING[0]!;
    const uploaded: FormDataEntryValue[] = [];
    server.use(
      http.post(apiUrl(`/cases/${task.case_id}/attachments`), async ({ request }) => {
        uploaded.push((await request.formData()).get("file")!);
        return HttpResponse.json({ id: 900 + uploaded.length }, { status: 201 });
      }),
    );
    const user = renderDetail(task.id);

    await user.click(await screen.findByRole("button", { name: "Tamamla" }));
    const dialog = await screen.findByRole("dialog", { name: "Görevi tamamla" });
    const input = within(dialog).getByLabelText(/Kanıt fotoğrafı/);

    await user.upload(input, new File(["x".repeat(EVIDENCE_MAX_BYTES + 1)], "buyuk.jpg", { type: "image/jpeg" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("en fazla 5 MB");

    await user.upload(input, new File(["foto"], "sabunluk.jpg", { type: "image/jpeg" }));
    await user.upload(input, [
      new File(["foto"], "lavabo.png", { type: "image/png" }),
      new File(["foto"], "yanlis.webp", { type: "image/webp" }),
    ]);
    await user.click(within(dialog).getByRole("button", { name: "yanlis.webp fotoğrafını kaldır" }));
    expect(within(dialog).getByText("sabunluk.jpg")).toBeInTheDocument();
    expect(within(dialog).getByText("lavabo.png")).toBeInTheDocument();
    expect(within(dialog).queryByText("yanlis.webp")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Tamamla" }));

    expect(await screen.findByText("Görev tamamlandı")).toBeInTheDocument();
    // Test ortaminda (jsdom File + Node Request) dosyanin adi ve icerigi istekte tasinmaz;
    // burada yalniz her fotograf icin bir yukleme istegi gittigi dogrulanir
    expect(uploaded).toHaveLength(2);
  });

  it("does not complete the task when the photo upload fails", async () => {
    server.use(
      http.post(apiUrl(`/cases/${IN_PROGRESS.case_id}/attachments`), () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "Bu bildirime en fazla 5 fotoğraf eklenebilir.", details: {} } },
          { status: 409 },
        ),
      ),
    );
    const user = renderDetail(IN_PROGRESS.id);

    await user.click(await screen.findByRole("button", { name: "Tamamla" }));
    const dialog = await screen.findByRole("dialog", { name: "Görevi tamamla" });
    await user.upload(
      within(dialog).getByLabelText(/Kanıt fotoğrafı/),
      new File(["foto"], "zemin.png", { type: "image/png" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Tamamla" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("en fazla 5 fotoğraf eklenebilir");
    expect(screen.queryByText("Görev tamamlandı")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }));
  });

  it("shows the evidence photos of a completed task", async () => {
    const done = { ...IN_PROGRESS, id: 777, status: "COMPLETED", completed_at: new Date().toISOString() };
    const photo = (id: number, kind: string) => ({ id, case_id: done.case_id, kind, url: `/api/v1/attachments/${id}` });
    server.use(
      http.get(apiUrl("/tasks/777"), () => HttpResponse.json(done)),
      http.get(apiUrl(`/cases/${done.case_id}/attachments`), () =>
        HttpResponse.json([photo(901, "REPORT"), photo(902, "EVIDENCE"), photo(903, "EVIDENCE")]),
      ),
      http.get(apiUrl("/attachments/:id"), () => new HttpResponse("png", { headers: { "Content-Type": "image/png" } })),
    );

    renderDetail(777);

    expect(await screen.findByRole("img", { name: "Kanıt fotoğrafı 2" })).toHaveAttribute("src", "blob:kanit");
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Kanıt fotoğrafları")).toBeInTheDocument();
  });

  it("completes a task with an optional note", async () => {
    const user = renderDetail(IN_PROGRESS.id);

    await user.click(await screen.findByRole("button", { name: "Tamamla" }));
    const dialog = await screen.findByRole("dialog", { name: "Görevi tamamla" });
    await user.type(within(dialog).getByLabelText("Not (isteğe bağlı)"), "Zemin kurulandı.");
    await user.click(within(dialog).getByRole("button", { name: "Tamamla" }));

    expect(await screen.findByText("Görev tamamlandı")).toBeInTheDocument();
    expect(screen.getByText("Zemin kurulandı.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tamamla" })).not.toBeInTheDocument();
  });

  it("declines a task only with a reason", async () => {
    const user = renderDetail(ACCEPTED.id);

    await user.click(await screen.findByRole("button", { name: "Reddet" }));
    const dialog = await screen.findByRole("dialog", { name: "Görevi reddet" });
    const submit = within(dialog).getByRole("button", { name: "Reddet" });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Reddetme nedeni"), "Bu iş teknik ekibin alanına giriyor.");
    await user.click(submit);

    expect(await screen.findByText("Görev reddedildi")).toBeInTheDocument();
    expect(screen.getByText("Bu iş teknik ekibin alanına giriyor.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Başlat" })).not.toBeInTheDocument();
  });

  it("shows the backend message when an action fails", async () => {
    server.use(
      http.post(apiUrl(`/tasks/${PENDING[1]!.id}/accept`), () =>
        HttpResponse.json(
          { error: { code: "INVALID_TRANSITION", message: "Görev başka birine atandı.", details: {} } },
          { status: 409 },
        ),
      ),
    );
    const user = renderDetail(PENDING[1]!.id);

    await user.click(await screen.findByRole("button", { name: "Kabul et" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Görev başka birine atandı.");
  });

  it("shows the same not found screen for a missing or foreign task", async () => {
    renderDetail(999999);

    expect(await screen.findByText("Kayıt bulunamadı")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Görevlerime dön" })).toHaveAttribute("href", "/staff/tasks");
  });
});
