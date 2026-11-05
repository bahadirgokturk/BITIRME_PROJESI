import Link from "next/link";

import type { CaseRead } from "@/hooks/useCases";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { reporterView } from "@/lib/status";

import { CaseStatusView } from "./CaseStatusView";

// Kart gorunumu: telefonda iki, masaustunde uc sutun; uzun baslik kirpilir, durum kartin altinda
export const TILE_CLASS =
  "flex h-full min-h-40 flex-col gap-1.5 surface p-3 transition-colors outline-none " +
  "hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50";

// Bildirimlerim kare karti (Figma: CaseTile; /my-cases - mobil/masaustu - kart gorunumu)
export function CaseTile({ item }: { item: CaseRead }) {
  return (
    <Link href={`/cases/${item.id}`} className={TILE_CLASS}>
      <h2 className="line-clamp-3 text-sm font-semibold break-words">{item.title}</h2>
      <p className="line-clamp-2 text-xs text-muted-foreground">{item.location.name}</p>
      <p className="text-xs text-muted-foreground">
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
          {relativeTime(item.created_at)}
        </time>
        {` · ${item.case_number}`}
      </p>
      <div className="mt-auto pt-1.5">
        <CaseStatusView view={reporterView(item.status, item.info_request)} compact />
      </div>
    </Link>
  );
}
