import { describe, expect, it } from "vitest";

import { bellLabel, notificationHref, unreadBadge } from "./notifications";

describe("notificationHref", () => {
  // Her rol bildirimin kendi detay ekranina gider: bildiren sade ekran, personel ve mudur kendi ekranlari
  it("opens the case on the screen of the signed-in role", () => {
    expect(notificationHref("REPORTER", 104)).toBe("/cases/104");
    expect(notificationHref("STAFF", 301)).toBe("/staff/cases/301");
    expect(notificationHref("MANAGER", 301)).toBe("/manager/cases/301");
    expect(notificationHref("ADMIN", 301)).toBe("/manager/cases/301");
  });
});

describe("unreadBadge", () => {
  it("shows the count, caps it and hides it when nothing is unread", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe("3");
    expect(unreadBadge(42)).toBe("9+");
  });
});

describe("bellLabel", () => {
  // Rozet yalniz gorseldir; ekran okuyucu sayiyi dugmenin adindan duyar
  it("says how many are unread", () => {
    expect(bellLabel(0)).toBe("Bildirimler: okunmamış yok");
    expect(bellLabel(2)).toBe("Bildirimler: 2 okunmamış");
  });
});
