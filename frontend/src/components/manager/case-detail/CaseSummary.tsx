import Link from "next/link";

import { PageTitle } from "@/components/layout/PageTitle";
import { CaseStatusBadge, PriorityBadge, SlaBadge } from "@/components/tasks/TaskBadges";
import { caseSla, type CaseRead } from "@/lib/caseList";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { useDelayRisk } from "@/hooks/useAnalytics";
import { factorsText, findCaseRisk } from "@/lib/delayRisk";
import { caseInfoFields } from "@/lib/managerCase";

import { RiskBadge } from "../dashboard/DelayRiskCard";

export const CARD_CLASS = "rounded-lg border bg-card p-4";
const INFO_TITLE_ID = "case-info-title";
const LINK_CLASS = "font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

// Numara, baslik ve uc rozet: durum, oncelik, kalan sure (Figma: 05 Manager > /manager/cases/[id])
export function CaseHeader({ item }: { item: CaseRead }) {
  const sla = caseSla(item);
  return (
    <header className="space-y-2.5">
      <p className="text-xs text-muted-foreground">
        {item.case_number} ·{" "}
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
          {relativeTime(item.created_at)}
        </time>
      </p>
      <PageTitle size="md">{item.title}</PageTitle>
      <ul aria-label="Durum" className="flex flex-wrap gap-2">
        <li>
          <CaseStatusBadge status={item.status} />
        </li>
        {item.priority ? (
          <li>
            <PriorityBadge priority={item.priority} />
          </li>
        ) : null}
        {sla ? (
          <li>
            <SlaBadge view={sla} />
          </li>
        ) : null}
      </ul>
    </header>
  );
}

// Inceleme kuyrugundaki bildirim: karar orada verilir, burada yalniz yol gosterilir
export function ReviewNotice() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-warning/10 px-4 py-3 text-sm">
      <p className="font-medium">Bu bildirim kararınızı bekliyor.</p>
      <Link href="/manager/review-queue" className={`${LINK_CLASS} inline-flex min-h-11 items-center md:min-h-0`}>
        İnceleme Kuyruğu&apos;na git
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

// Bildirim birimin en riskli acik isleri arasindaysa: seviye rozeti ve gerekceler (Figma: InfoCard, Gecikme riski)
function DelayRiskField({ item }: { item: CaseRead }) {
  const risk = findCaseRisk(useDelayRisk(item.department?.id).data, item.id);
  if (!risk) {
    return null;
  }
  const factors = factorsText(risk);
  return (
    <Field label="Gecikme riski">
      <span className="flex flex-col gap-1">
        <RiskBadge item={risk} />
        {factors ? <span className="text-xs text-muted-foreground">{factors}</span> : null}
      </span>
    </Field>
  );
}

// showRisk: rolun analitige yetkisi varsa (mudur, yonetici)
export function CaseInfo({ item, showRisk = false }: { item: CaseRead; showRisk?: boolean }) {
  return (
    <section aria-labelledby={INFO_TITLE_ID} className={`${CARD_CLASS} space-y-3`}>
      <h2 id={INFO_TITLE_ID} className="font-semibold">
        Bildirim bilgileri
      </h2>
      <dl className="space-y-3">
        {caseInfoFields(item).map((field) => (
          <Field key={field.label} label={field.label}>
            {field.value}
          </Field>
        ))}
        {showRisk ? <DelayRiskField item={item} /> : null}
        {item.parent_case_id === null ? null : (
          <Field label="Birleştirildiği bildirim">
            <Link href={`/manager/cases/${item.parent_case_id}`} className={LINK_CLASS}>
              Bildirimi aç
            </Link>
          </Field>
        )}
      </dl>
    </section>
  );
}
