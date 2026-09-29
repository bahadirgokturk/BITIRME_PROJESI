// Yorum, puan ve yeniden acmanin sahte karsiliklari (cevrimdisi mod; gercek API E3-5).
// Sahte API her istegi REPORTER yapmis sayar; 72 saat penceresi ve rol kurallarini gercek backend denetler.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { findCase } from "./caseHandlers";
import { USERS } from "./fixtures";

type Schemas = components["schemas"];

const FIRST_COMMENT_ID = 500;

// Oturum boyunca yazilan yorumlar; sayfa yenilenince sifirlanir
const comments: Schemas["CommentRead"][] = [];

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

const notFound = () => error(404, "NOT_FOUND", "Kayıt bulunamadı.");

export const interactionHandlers = [
  http.post<{ id: string }, Schemas["CommentCreate"]>(
    apiUrl("/cases/:id/comments"),
    async ({ request, params }) => {
      const item = findCase(params.id);
      if (!item) {
        return notFound();
      }
      const { body } = await request.json();
      if (!body?.trim()) {
        return error(422, "VALIDATION_ERROR", "Gönderilen veriler geçersiz.");
      }
      const comment: Schemas["CommentRead"] = {
        id: FIRST_COMMENT_ID + comments.length,
        case_id: item.id,
        body: body.trim(),
        is_internal: false,
        author_id: USERS.REPORTER.id,
        author_name: USERS.REPORTER.full_name,
        author_role: "REPORTER",
        created_at: new Date().toISOString(),
      };
      comments.push(comment);
      return HttpResponse.json(comment, { status: 201 });
    },
  ),

  http.get(apiUrl("/cases/:id/comments"), ({ params }) => {
    const item = findCase(params.id);
    return item
      ? HttpResponse.json(comments.filter((c) => c.case_id === item.id))
      : notFound();
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
      return error(
        409,
        "INVALID_TRANSITION",
        "Bildirim bu durumdan istenen duruma geçirilemez.",
      );
    }
    item.status = "REOPENED";
    item.reopened_count += 1;
    return HttpResponse.json(item);
  }),
];
