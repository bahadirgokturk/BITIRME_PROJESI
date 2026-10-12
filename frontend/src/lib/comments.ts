// Bildirim yorumlarinin kurallari (docs/API.md "Yorum, puan, yeniden acma"; backend/app/services/case_interaction_service.py)
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type Role = Schemas["UserRole"];
export type CommentRead = Schemas["CommentRead"];

// Backend siniri: backend/app/core/constants.py COMMENT_MAX_LENGTH
export const COMMENT_MAX_LENGTH = 2000;

// Yonetici bildirimleri gorur ama yorum yazamaz (backend 403 doner)
export function canComment(role: Role): boolean {
  return role !== "ADMIN";
}

// Ic not: yalniz personel ve mudur yazar ve gorur; bildirim yapan hic gormez
const INTERNAL_NOTE_ROLES: readonly Role[] = ["STAFF", "MANAGER"];

export function canWriteInternal(role: Role): boolean {
  return INTERNAL_NOTE_ROLES.includes(role);
}

// Bos yorum gonderilemez (dugme kapali durur); burada yalniz uzunluk denetlenir
export function commentProblem(body: string): string | null {
  return body.trim().length > COMMENT_MAX_LENGTH ? `Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.` : null;
}
