"use client";

import Link from "next/link";
import { useId } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { usePendingReports, usePendingSync, useRemovePending, useSentReports } from "@/hooks/usePendingReports";
import { useLocations } from "@/hooks/useReport";
import { pendingMeta, pendingSentText, pendingStatus, pendingTitle, type PendingReport } from "@/lib/pendingReports";

const LINK_CLASS =
  "font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

function PendingRow({ report, locationName }: { report: PendingReport; locationName: string }) {
  const remove = useRemovePending();
  const status = pendingStatus(report);
  return (
    <li className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="line-clamp-2 text-sm font-medium break-words">{report.description}</p>
        <p className="text-xs text-muted-foreground">{pendingMeta(report, locationName)}</p>
        <p className={cn("text-xs", status.failed ? "text-destructive" : "text-muted-foreground")}>{status.text}</p>
      </div>
      {status.failed ? (
        <Button
          variant="outline"
          className="h-11 shrink-0 px-3 md:h-9"
          disabled={remove.isPending}
          onClick={() => remove.mutate(report.id)}
          aria-label={`Sil: ${report.description}`}
        >
          Sil
        </Button>
      ) : null}
    </li>
  );
}

function WaitingList({ reports }: { reports: PendingReport[] }) {
  const titleId = useId();
  const locations = useLocations();
  const nameOf = (id: number) => locations.data?.find((location) => location.id === id)?.name ?? "Seçilen konum";
  return (
    <section aria-labelledby={titleId} className="space-y-2.5 rounded-xl bg-warning/10 px-4 py-3.5">
      <h2 id={titleId} className="text-sm font-semibold">
        {pendingTitle(reports.length)}
      </h2>
      <ul className="space-y-2">
        {reports.map((report) => (
          <PendingRow key={report.id} report={report} locationName={nameOf(report.locationId)} />
        ))}
      </ul>
    </section>
  );
}

// Bildirimlerim'in ustu: bu cihazda gonderilmeyi bekleyenler ve bu oturumda siradan gonderilenler
// (Figma: /my-cases - gonderilmeyi bekleyen, - bekleyen gonderildi)
export function PendingReports() {
  const reports = usePendingReports().data ?? [];
  const sent = useSentReports();
  return (
    <>
      {reports.length > 0 ? <WaitingList reports={reports} /> : null}
      {sent.map((item) => (
        <p
          key={item.caseId}
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-success/10 px-4 py-3 text-sm"
        >
          <span className="font-medium text-success">{pendingSentText(item.caseNumber)}</span>
          <Link href={`/cases/${item.caseId}`} className={LINK_CLASS}>
            Aç
          </Link>
        </p>
      ))}
    </>
  );
}

// Uygulama kabugunda: hangi sayfada olunursa olsun baglanti gelince bekleyenleri gonderir
export function PendingSync() {
  usePendingSync();
  return null;
}
