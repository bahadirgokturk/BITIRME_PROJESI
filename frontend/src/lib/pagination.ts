import { apiGet } from "@/lib/api/client";

// Sayfali liste (docs/API.md: ?page=&page_size=, cevap {items, total, page}) icin sonraki sayfa hesabi
interface PageLike {
  page: number;
  total: number;
  items: readonly unknown[];
}

// Yuklenen kayit toplamdan azsa sonraki sayfa istenir. Bos sayfa gelirse durulur: liste yuklenirken
// kayit silinirse toplam eskiyebilir ve sonsuz istek olmamali.
export function nextPage(lastPage: PageLike, allPages: readonly PageLike[]): number | undefined {
  const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
  if (lastPage.items.length === 0 || loaded >= lastPage.total) {
    return undefined;
  }
  return lastPage.page + 1;
}

// Aktarimda bir istekte okunan kayit: backend'in page_size ust siniri (backend/app/core/constants.py PAGE_SIZE_MAX)
export const EXPORT_PAGE_SIZE = 200;
// Toplam liste okunurken degisirse sonsuz istek olmasin: 50 sayfa = 10.000 kayit, kampus olcegi icin bol
const EXPORT_MAX_PAGES = 50;

// Sayfali listenin tamami (Excel'e aktar): sayfalar sirayla istenir, toplam dolunca ya da bos sayfada durulur
export async function fetchAllPages<T>(pathFor: (page: number) => string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
    const result = await apiGet<{ items: T[]; total: number; page: number }>(pathFor(page));
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) {
      break;
    }
  }
  return items;
}
