import { describe, expect, it } from "vitest";

import { COMMENT_MAX_LENGTH, canComment, canWriteInternal, commentProblem } from "./comments";

describe("comment rules", () => {
  it("lets everyone but the admin comment", () => {
    expect(canComment("REPORTER")).toBe(true);
    expect(canComment("STAFF")).toBe(true);
    expect(canComment("MANAGER")).toBe(true);
    expect(canComment("ADMIN")).toBe(false);
  });

  it("keeps internal notes to staff and managers", () => {
    expect(canWriteInternal("STAFF")).toBe(true);
    expect(canWriteInternal("MANAGER")).toBe(true);
    expect(canWriteInternal("REPORTER")).toBe(false);
    expect(canWriteInternal("ADMIN")).toBe(false);
  });

  it("accepts a comment up to the backend limit and explains when it is too long", () => {
    expect(commentProblem("a".repeat(COMMENT_MAX_LENGTH))).toBeNull();
    expect(commentProblem("a".repeat(COMMENT_MAX_LENGTH + 1))).toBe("Yorum en fazla 2000 karakter olabilir.");
  });
});
