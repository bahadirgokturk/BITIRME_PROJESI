import { afterEach, describe, expect, it } from "vitest";

import { apiGet, resetTransport, setTransport } from "./client";
import { isServerReachable, markServerReachable } from "./reachability";

afterEach(() => {
  resetTransport();
  markServerReachable(true);
});

describe("server reachability", () => {
  it("is lost when a request fails on the network and back once the server answers", async () => {
    setTransport(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(apiGet("/health")).rejects.toThrow(TypeError);
    expect(isServerReachable()).toBe(false);

    setTransport(() => Promise.resolve(Response.json({ error: { code: "X", message: "x", details: {} } }, { status: 500 })));
    await expect(apiGet("/health")).rejects.toThrow();
    // Hata cevabi da cevaptir: sunucuya ulasildi
    expect(isServerReachable()).toBe(true);
  });

  it("does not count a cancelled request as a lost connection", async () => {
    setTransport(() => Promise.reject(new DOMException("aborted", "AbortError")));

    await expect(apiGet("/health")).rejects.toThrow();

    expect(isServerReachable()).toBe(true);
  });
});
