// Tarih gosterimi: goreli ("3 saat once") + uzerine gelince tam tarih, Europe/Istanbul (docs/UI_GUIDE.md bolum 6)
const LOCALE = "tr-TR";
const TIME_ZONE = "Europe/Istanbul";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// numeric "always": "auto" 2 gun icin "evvelsi gun" diyor, kullaniciya yabanci
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "always" });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / MS_PER_MINUTE);
  if (minutes < 1) {
    return "Az önce";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return relative.format(-minutes, "minute");
  }
  if (minutes < MINUTES_PER_DAY) {
    return relative.format(-Math.floor(minutes / MINUTES_PER_HOUR), "hour");
  }
  return relative.format(-Math.floor(minutes / MINUTES_PER_DAY), "day");
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
