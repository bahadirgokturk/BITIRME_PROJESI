// Yorum, puan, yeniden acma ve ek bilgi yanitinin sahte karsiliklari (cevrimdisi mod; gercek API E3-5).
// Yorumlar giris yapan sahte kullanicinin roluyle yazilir ve okunur (session.ts); puan, yeniden acma ve ek bilgi
// REPORTER sayilir. 72 saat penceresini yalniz gercek backend denetler.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { findCase } from "./caseHandlers";
import { currentUser } from "./session";
import { TASKS } from "./taskFixtures";

type Schemas = components["schemas"];

const FIRST_COMMENT_ID = 500;

// Oturum boyunca yazilan yorumlar; sayfa yenilenince sifirlanir
let comments: Schemas["CommentRead"][] = [];

// Testler her seferinde bos listeyle baslar
export function resetComments(): void {
  comments = [];
}

// Ic not kurali backend ile ayni (backend/app/services/case_interaction_service.py)
const INTERNAL_NOTE_ROLES: readonly Schemas["UserRole"][] = ["STAFF", "MANAGER"];
const seesInternal = () => INTERNAL_NOTE_ROLES.includes(currentUser().role);

function addComment(caseId: number, body: string, isInternal: boolean): Schemas["CommentRead"] {
  const author = currentUser();
  const comment: Schemas["CommentRead"] = {
    id: FIRST_COMMENT_ID + comments.length,
    case_id: caseId,
    body,
    is_internal: isInternal,
    author_id: author.id,
    author_name: author.full_name,
    author_role: author.role,
    created_at: new Date().toISOString(),
  };
  comments.push(comment);
  return comment;
}

// Ek bilgi yaniti bildirenin herkese acik yorumu olarak da eklenir
const publicComment = (caseId: number, body: string) => addComment(caseId, body, false);

// Personel gorevlerinin bildirimleri sahte bildirim listesinde olmayabilir (taskFixtures.ts): onlara da yorum yazilir
function commentCaseId(id: string | readonly string[] | undefined): number | null {
  const known = findCase(id)?.id ?? TASKS.find((task) => String(task.case_id) === id)?.case_id;
  return known ?? null;
}

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

const forbidden = () => error(403, "FORBIDDEN", "Bu işlem için yetkiniz yok.");
const notFound = () => error(404, "NOT_FOUND", "Kayıt bulunamadı.");
const invalidTransition = () =>
  error(409, "INVALID_TRANSITION", "Bildirim bu durumdan istenen duruma geçirilemez.");
const invalidBody = () => error(422, "VALIDATION_ERROR", "Gönderilen veriler geçersiz.");

export const interactionHandlers = [
  http.post<{ id: string }, Schemas["CommentCreate"]>(
    apiUrl("/cases/:id/comments"),
    async ({ request, params }) => {
      const caseId = commentCaseId(params.id);
      if (caseId === null) {
        return notFound();
      }
      const { body, is_internal: isInternal = false } = await request.json();
      if (!body?.trim()) {
        return invalidBody();
      }
      if (currentUser().role === "ADMIN" || (isInternal && !seesInternal())) {
        return forbidden();
      }
      return HttpResponse.json(addComment(caseId, body.trim(), isInternal), { status: 201 });
    },
  ),

  http.get(apiUrl("/cases/:id/comments"), ({ params }) => {
    const caseId = commentCaseId(params.id);
    return caseId === null
      ? notFound()
      : HttpResponse.json(comments.filter((c) => c.case_id === caseId && (seesInternal() || !c.is_internal)));
  }),

  http.post<{ id: string }, Schemas["FeedbackCreate"]>(
    apiUrl("/cases/:id/feedback"),
    async ({ request, params }) => {
      const item = findCase(params.id);
      if (!item) {
        return notFound();
      }
      if (item.status !== "CLOSED") {
        return error(
          409,
          "CONFLICT",
          "Yalnız kapanmış bildirim puanlanabilir.",
        );
      }
      if (item.satisfaction_rating !== null) {
        return error(409, "CONFLICT", "Bu bildirim zaten puanlandı.");
      }
      item.satisfaction_rating = (await request.json()).rating;
      return HttpResponse.json(item);
    },
  ),

  http.post(apiUrl("/cases/:id/reopen"), ({ params }) => {
    const item = findCase(params.id);
    if (!item) {
      return notFound();
    }
    if (item.status !== "CLOSED" && item.status !== "VERIFICATION") {
      return invalidTransition();
    }
    item.status = "REOPENED";
    item.reopened_count += 1;
    return HttpResponse.json(item);
  }),

  // Yanit herkese acik yorum olarak da eklenir, bildirim yeniden analize doner
  http.post<{ id: string }, Schemas["InfoReplyCreate"]>(
    apiUrl("/cases/:id/info"),
    async ({ request, params }) => {
      const item = findCase(params.id);
      if (!item) {
        return notFound();
      }
      if (item.status !== "NEEDS_INFO") {
        return invalidTransition();
      }
      const { body } = await request.json();
      if (!body?.trim()) {
        return invalidBody();
      }
      publicComment(item.id, body.trim());
      item.status = "ANALYZING";
      item.info_request = null;
      return HttpResponse.json(item);
    },
  ),
];
