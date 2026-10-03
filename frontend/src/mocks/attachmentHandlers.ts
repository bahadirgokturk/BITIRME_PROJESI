// Bildirim fotograf ve videolarinin sahte karsiliklari (cevrimdisi mod; gercek API E3-3).
// Not: gercek backend turu dosya icerigiyle anlar ve EXIF'i siler; burada yalniz File.type'a bakilir.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { USERS } from "./fixtures";

type Attachment = components["schemas"]["AttachmentRead"];

// Backend ile ayni kurallar: backend/app/core/constants.py
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// Not: 30 sn video siniri burada denetlenemez (sure dosyanin icinde); gercek backend 422 VIDEO_TOO_LONG doner
const MAX_PER_CASE = 5;
const FIRST_ID = 900;

// 1x1 seffaf PNG: indirilen her sahte dosya (video dahil) bu goruntudur; gercek video icin backend
const PIXEL_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (char) => char.charCodeAt(0),
);

// Oturum boyunca yuklenenler; sayfa yenilenince sifirlanir
const attachments: Attachment[] = [];

function error(status: number, code: string, message: string) {
  const body: components["schemas"]["ErrorRead"] = {
    error: { code, message, details: {} },
  };
  return HttpResponse.json(body, { status });
}

const unsupported = () =>
  error(
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Yalnız JPG, PNG, WEBP fotoğraf ya da MP4, MOV video yüklenebilir.",
  );

function rejection(file: File, caseId: number) {
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isVideo && !IMAGE_TYPES.includes(file.type)) {
    return unsupported();
  }
  if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    return error(
      413,
      "FILE_TOO_LARGE",
      isVideo
        ? "Dosya çok büyük. En fazla 50 MB yüklenebilir."
        : "Dosya çok büyük. En fazla 10 MB yüklenebilir.",
    );
  }
  if (
    attachments.filter((item) => item.case_id === caseId).length >= MAX_PER_CASE
  ) {
    return error(
      409,
      "CONFLICT",
      "Bu bildirime en fazla 5 fotoğraf eklenebilir.",
    );
  }
  return null;
}

// Gercek backend turu yukleyenin rolunden belirler (personel -> EVIDENCE). Sahte modda rol tektir;
// personel ekranindan (/staff/...) yuklenen dosya kanit sayilir.
// Resolution Agent'in sahte karsiligi (taskHandlers.ts) kanit fotografi var mi diye buraya bakar
export function hasEvidence(caseId: number): boolean {
  return attachments.some((item) => item.case_id === caseId && item.kind === "EVIDENCE");
}

function uploadKind(): Attachment["kind"] {
  const onStaffScreen = typeof location !== "undefined" && location.pathname.startsWith("/staff/");
  return onStaffScreen ? "EVIDENCE" : "REPORT";
}

export const attachmentHandlers = [
  http.post(apiUrl("/cases/:id/attachments"), async ({ request, params }) => {
    const caseId = Number(params.id);
    const file = (await request.formData()).get("file");
    // instanceof File kullanilmaz: test ortaminda (jsdom) ve Node icinde farkli File siniflari var
    if (file === null || typeof file === "string") {
      return unsupported();
    }
    const rejected = rejection(file, caseId);
    if (rejected) {
      return rejected;
    }
    const id = FIRST_ID + attachments.length;
    const created: Attachment = {
      id,
      case_id: caseId,
      kind: uploadKind(),
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: USERS.REPORTER.id,
      created_at: new Date().toISOString(),
      url: `/api/v1/attachments/${id}`,
    };
    attachments.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(apiUrl("/cases/:id/attachments"), ({ params }) =>
    HttpResponse.json(
      attachments.filter((item) => item.case_id === Number(params.id)),
    ),
  ),

  http.get(apiUrl("/attachments/:id"), ({ params }) => {
    const item = attachments.find(
      (attachment) => attachment.id === Number(params.id),
    );
    if (!item) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    return new HttpResponse(PIXEL_PNG, {
      headers: { "Content-Type": "image/png" },
    });
  }),
];
