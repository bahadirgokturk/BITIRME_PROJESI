import { describe, expect, it } from "vitest";

import { ApiError } from "./api/client";
import { shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("does not retry when the backend answered with an error", () => {
    expect(shouldRetry(0, new ApiError(501, "NOT_IMPLEMENTED", "", {}))).toBe(false);
  });

  it("retries a network failure once", () => {
    const networkError = new TypeError("Failed to fetch");

    expect(shouldRetry(0, networkError)).toBe(true);
    expect(shouldRetry(1, networkError)).toBe(false);
  });
});
