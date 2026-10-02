import { describe, expect, it } from "vitest";

import { nextPage } from "./pagination";

const page = (number: number, count: number, total: number) => ({
  page: number,
  total,
  items: Array.from({ length: count }, (_, i) => i),
});

describe("nextPage", () => {
  it("asks for the next page while fewer items than the total are loaded", () => {
    const first = page(1, 20, 25);

    expect(nextPage(first, [first])).toBe(2);
  });

  it("stops when every item is loaded", () => {
    const first = page(1, 20, 25);
    const second = page(2, 5, 25);

    expect(nextPage(second, [first, second])).toBeUndefined();
  });

  it("stops on an empty list", () => {
    const empty = page(1, 0, 0);

    expect(nextPage(empty, [empty])).toBeUndefined();
  });

  it("stops if the backend returns an empty page before the total is reached", () => {
    // Liste yuklenirken kayit silinirse toplam eskiyebilir; bos sayfada sonsuz istek olmasin
    const first = page(1, 20, 25);
    const second = page(2, 0, 25);

    expect(nextPage(second, [first, second])).toBeUndefined();
  });
});
