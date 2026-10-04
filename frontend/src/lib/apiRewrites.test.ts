import { describe, expect, it } from "vitest";

import { apiRewrites } from "./apiRewrites";

describe("apiRewrites", () => {
  it("yerelde (BACKEND_ORIGIN yok) yonlendirme yapmaz", () => {
    expect(apiRewrites(undefined)).toEqual([]);
    expect(apiRewrites("")).toEqual([]);
  });

  it("staging'de /api/v1 isteklerini backend'e aktarir", () => {
    expect(apiRewrites("https://campusflow-api-staging.onrender.com")).toEqual([
      {
        source: "/api/v1/:path*",
        destination: "https://campusflow-api-staging.onrender.com/api/v1/:path*",
      },
    ]);
  });

  it("sondaki egik cizgiyi tekrarlamaz", () => {
    expect(apiRewrites("https://api.example.com/")[0]?.destination).toBe(
      "https://api.example.com/api/v1/:path*",
    );
  });
});
