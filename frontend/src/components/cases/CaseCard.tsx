import { MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import type { CaseRead } from "@/hooks/useCases";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { reporterView } from "@/lib/status";

import { CaseStatusView } from "./CaseStatusView";

const CARD_CLASS = "block surface p-4 md:p-5";

export function CaseCard({ item }: { item: CaseRead }) {
  return (
    <Link
      href={`/cases/${item.id}`}
      className={`${CARD_CLASS} transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      {/* Yeni stil (Figma: 08 Yeni Stil (A) > Bildirimlerim): ustte numara ve zaman, sonra baslik ve konum */}
      <p className="text-xs text-muted-foreground md:text-[13px]">
        {`${item.case_number} · `}
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
          {relativeTime(item.created_at)}
        </time>
      </p>
      <h2 className="mt-1 font-semibold md:text-[17px]">{item.title}</h2>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
        {item.location.name}
      </p>
      <div className="mt-3">
        <CaseStatusView view={reporterView(item.status, item.info_request)} />
      </div>
    </Link>
  );
}

export function CaseCardSkeleton() {
  return (
    <div className={`${CARD_CLASS} space-y-2.5`}>
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-2.5 w-1/3" />
      <div className="grid grid-cols-4 gap-1 pt-2">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-1" />
        ))}
      </div>
    </div>
  );
}
