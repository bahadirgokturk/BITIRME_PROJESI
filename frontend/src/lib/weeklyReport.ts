// Haftalik yonetici raporu (GET /analytics/weekly-report, PDF). Hafta pazartesi-pazar; backend haftayi
// icindeki herhangi bir gunden bulur (weekly_report_service.week_of), biz pazartesiyi gondeririz.

const DAYS_PER_WEEK = 7;
const DATE_PART = 2;
// Ekranda secilebilen tamamlanmis hafta sayisi: son bir ay yeterli, daha eskisi icin Raporlar ekrani var
export const WEEK_CHOICES = 4;

const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "short" });

export interface ReportWeek {
  // "2026-11-09": istekte ve dosya adinda kullanilir
  monday: string;
  // "9-15 Kas 2026" gibi (ekranda uzun tire)
  label: string;
}

function isoDay(day: Date): string {
  const pad = (value: number) => String(value).padStart(DATE_PART, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function addDays(day: Date, days: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

// Ay ya da yil degisiyorsa iki tarafa da yazilir: "26 Eki - 1 Kas 2026", "28 Ara 2026 - 3 Oca 2027"
function weekLabel(first: Date, last: Date): string {
  const end = `${last.getDate()} ${MONTH.format(last)} ${last.getFullYear()}`;
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getDate()} ${MONTH.format(first)} ${first.getFullYear()} – ${end}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${first.getDate()} ${MONTH.format(first)} – ${end}`;
  }
  return `${first.getDate()}–${end}`;
}

// Icinde bulunulan hafta henuz bitmedigi icin listede yok; en yeni hafta ustte
export function recentWeeks(now: Date = new Date(), count: number = WEEK_CHOICES): ReportWeek[] {
  const daysSinceMonday = (now.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const thisMonday = addDays(now, -daysSinceMonday);
  return Array.from({ length: count }, (_, index) => {
    const monday = addDays(thisMonday, -DAYS_PER_WEEK * (index + 1));
    return { monday: isoDay(monday), label: weekLabel(monday, addDays(monday, DAYS_PER_WEEK - 1)) };
  });
}

export function weeklyReportPath(monday: string): string {
  return `/analytics/weekly-report?week=${monday}`;
}

// Backend'in Content-Disposition adiyla ayni
export function weeklyReportFileName(monday: string): string {
  return `haftalik-rapor-${monday}.pdf`;
}
