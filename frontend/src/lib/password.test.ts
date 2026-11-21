import { describe, expect, it } from "vitest";

import { passwordProblems, resetPasswordProblem } from "./password";

const VALID = { current: "gecici-parola", next: "yeni-parola-1", repeat: "yeni-parola-1" };

describe("passwordProblems", () => {
  it("accepts a new password of at least 8 characters typed twice", () => {
    expect(passwordProblems(VALID)).toEqual({});
  });

  // Backend kurallariyla ayni (backend/app/schemas/user.py PASSWORD_MIN_LENGTH); istek gitmeden soylenir
  it("explains each problem next to its field", () => {
    expect(passwordProblems({ ...VALID, current: "" })).toEqual({ current: "Mevcut parolayı yazın." });
    expect(passwordProblems({ ...VALID, next: "kisa", repeat: "kisa" })).toEqual({
      next: "Yeni parola en az 8 karakter olmalı.",
    });
    expect(passwordProblems({ ...VALID, repeat: "baska-parola" })).toEqual({ repeat: "Yeni parolalar aynı değil." });
    expect(passwordProblems({ current: "ayni-parola", next: "ayni-parola", repeat: "ayni-parola" })).toEqual({
      next: "Yeni parola mevcut parolayla aynı olamaz.",
    });
  });
});

describe("resetPasswordProblem", () => {
  it("asks for a temporary password of at least 8 characters", () => {
    expect(resetPasswordProblem("kisa")).toBe("Geçici parola en az 8 karakter olmalı.");
    expect(resetPasswordProblem("gecici-parola")).toBeNull();
  });
});
