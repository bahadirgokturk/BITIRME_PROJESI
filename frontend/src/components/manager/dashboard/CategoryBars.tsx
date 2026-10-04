import { barPercent, topCategoryHeadline, type CategoriesRead } from "@/lib/analytics";

import { ChartCard, EmptyChart } from "./ChartCard";

const SUBTITLE = "Kategoriye göre bildirim sayısı";

export function CategoryBars({ categories, className }: { categories: CategoriesRead; className?: string }) {
  const items = [...categories.items].sort((a, b) => b.count - a.count);
  const max = items[0]?.count ?? 0;
  return (
    <ChartCard title={topCategoryHeadline(categories)} subtitle={SUBTITLE} className={className}>
      {max === 0 ? (
        <EmptyChart>Gösterilecek kategori yok.</EmptyChart>
      ) : (
        <ul aria-label={SUBTITLE} className="space-y-3">
          {items.map((item) => (
            <li key={item.category} className="space-y-1">
              <div className="flex justify-between gap-2 text-sm">
                <span>{item.label}</span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div aria-hidden className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${barPercent(item.count, max)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
