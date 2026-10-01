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
