// Personel gorevlerinin sahte karsiliklari (cevrimdisi mod; gercek API E4-1).
// Gecisler backend ile ayni: PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED; reddetme PENDING/ACCEPTED'dan.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { TASKS } from "./taskFixtures";

type Schemas = components["schemas"];
type Task = Schemas["TaskRead"];
type TaskStatus = Schemas["TaskStatus"];

// Oturum boyunca durum degisiklikleri burada tutulur; sayfa yenilenince sifirlanir
const tasks: Task[] = TASKS.map((task) => ({ ...task }));

const ALLOWED: Record<string, { from: TaskStatus[]; to: TaskStatus; stamp?: keyof Task }> = {
  accept: { from: ["PENDING"], to: "ACCEPTED", stamp: "accepted_at" },
  start: { from: ["ACCEPTED"], to: "IN_PROGRESS", stamp: "started_at" },
  complete: { from: ["IN_PROGRESS"], to: "COMPLETED", stamp: "completed_at" },
  decline: { from: ["PENDING", "ACCEPTED"], to: "DECLINED" },
};

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

// SLA'ya kalan sure en az olan once; bitis zamani olmayanlar sona
function byUrgency(a: Task, b: Task) {
  return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
}

async function note(request: Request): Promise<Partial<Task>> {
  const text = await request.text();
  if (!text) {
    return {};
  }
  const body = JSON.parse(text) as { reason?: string; completion_note?: string };
  return { declined_reason: body.reason ?? null, completion_note: body.completion_note ?? null };
}

export const taskHandlers = [
  http.get(apiUrl("/tasks/mine"), ({ request }) => {
    const statuses = new URL(request.url).searchParams.getAll("status");
    const items = tasks
      .filter((task) => !statuses.length || statuses.includes(task.status))
      .sort(byUrgency);
    return HttpResponse.json({ items, total: items.length, page: 1 });
  }),

  http.get(apiUrl("/tasks/:id"), ({ params }) => {
    const task = tasks.find((item) => String(item.id) === params.id);
    return task ? HttpResponse.json(task) : error(404, "NOT_FOUND", "Kayıt bulunamadı.");
  }),

  http.post(apiUrl("/tasks/:id/:action"), async ({ params, request }) => {
    const task = tasks.find((item) => String(item.id) === params.id);
    const rule = ALLOWED[String(params.action)];
    if (!task || !rule) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (!rule.from.includes(task.status)) {
      return error(409, "INVALID_TRANSITION", "Görev bu durumdan istenen duruma geçirilemez.");
    }
    Object.assign(task, await note(request), { status: rule.to });
    if (rule.stamp) {
      Object.assign(task, { [rule.stamp]: new Date().toISOString() });
    }
    return HttpResponse.json(task);
  }),
];
