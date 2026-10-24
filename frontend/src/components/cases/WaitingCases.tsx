"use client";

import { BellRingIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { useWaitingCases } from "@/hooks/useCases";
import { actionNeeded, waitingPreview } from "@/lib/caseActions";

const TITLE_ID = "waiting-cases-title";

// Bildirimlerim'in ustunde, bildirenin bir sey yapmasi gereken bildirimler (Figma: ActionNeededCard).
// Yuklenirken, hata olursa ya da bekleyen yoksa kutu cikmaz: asil liste kendi durumunu zaten gosterir.
export function WaitingCases() {
  const query = useWaitingCases();
  const waiting = query.data ? actionNeeded(query.data) : [];
  if (waiting.length === 0) {
    return null;
  }
  const { visible, moreText } = waitingPreview(waiting);
  return (
    <section aria-labelledby={TITLE_ID} className="space-y-1 rounded-lg bg-warning/10 px-4 pt-3.5 pb-1.5">
      <h2 id={TITLE_ID} className="flex items-center gap-2 text-[15px] font-semibold">
        <BellRingIcon aria-hidden className="size-[18px] shrink-0 text-warning" />
        Sizden yanıt bekleniyor ({waiting.length})
      </h2>
      <ul>
        {visible.map(({ item, reason }) => (
          <li key={item.id}>
            <Link
              href={`/cases/${item.id}`}
              className="flex min-h-11 items-center gap-2 rounded-md py-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{reason}</span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {moreText ? <p className="pb-2 text-xs text-muted-foreground">{moreText}</p> : null}
    </section>
  );
}
