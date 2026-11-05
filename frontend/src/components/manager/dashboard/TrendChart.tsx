import { barPercent, bucketLabel, trendHeadline, type TrendRead } from "@/lib/analytics";

import { ChartCard, EmptyChart } from "./ChartCard";

const PERCENT = 100;
const LIST_LABEL = "Açılan ve kapanan bildirimler";
const UNIT: Record<TrendRead["granularity"], string> = { day: "günlük", week: "haftalık", month: "aylık" };

// Renk yolculugu (docs/UI_GUIDE.md bolum 4): acilan turuncu, kapanan turkuaz. Durum renkleri
// (yesil/sari/kirmizi) grafikte kullanilmaz, karismasin.
const SERIES = [
  { key: "opened", label: "Açılan", className: "bg-brand-accent" },
  { key: "closed", label: "Kapanan", className: "bg-primary" },
] as const;

function Legend() {
  return (
    <ul aria-hidden className="flex gap-4 text-xs text-muted-foreground">
      {SERIES.map((series) => (
        <li key={series.key} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[2px] ${series.className}`} />
          {series.label}
        </li>
      ))}
    </ul>
  );
}

interface BarsProps {
  point: TrendRead["points"][number];
  max: number;
}

// Cubuklar susleme: sayilar ekran okuyucuya satirin metniyle verilir. Sayi etiketi cubugun ustunde
// durur; cubuk yuksekligi etiket payi (1rem) dusulerek oranlanir, en uzun cubuk tasmasin.
function Bars({ point, max }: BarsProps) {
  return (
    <div aria-hidden className="flex h-36 items-end justify-center gap-[3px] border-b md:h-44 md:gap-1">
      {SERIES.map((series) => (
        <div key={series.key} className="flex h-full w-3.5 flex-col justify-end md:w-[22px]">
          <span className="h-4 text-center text-xs leading-4 text-muted-foreground">{point[series.key]}</span>
          <div
            className={`rounded-t-[3px] ${series.className}`}
            style={{ height: `calc((100% - 1rem) * ${barPercent(point[series.key], max) / PERCENT})` }}
          />
        </div>
      ))}
    </div>
  );
}

// Grafik kutuphanesi yok (ekip karari): cubuklar duz HTML/CSS, yukseklik en buyuk degere oranlanir
export function TrendChart({ trend }: { trend: TrendRead }) {
  const max = Math.max(0, ...trend.points.flatMap((point) => [point.opened, point.closed]));
  return (
    <ChartCard title={trendHeadline(trend.points)} subtitle={`${LIST_LABEL} · ${UNIT[trend.granularity]}`} className="h-full">
      {max === 0 ? (
        <EmptyChart>Seçilen dönemde açılan ya da kapanan bildirim olmadı.</EmptyChart>
      ) : (
        <>
          <Legend />
          <ul aria-label={LIST_LABEL} className="flex gap-1 md:gap-3">
            {trend.points.map((point) => {
              const label = bucketLabel(point.bucket, trend.granularity);
              return (
                <li key={point.bucket} className="min-w-0 flex-1 space-y-1.5 text-center">
                  <Bars point={point} max={max} />
                  <span aria-hidden className="block text-xs text-muted-foreground">
                    {label}
                  </span>
                  <span className="sr-only">{`${label}: ${point.opened} açılan, ${point.closed} kapanan`}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
