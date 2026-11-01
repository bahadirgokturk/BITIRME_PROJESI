import type { ReactNode } from "react";

import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

// break-inside-avoid: yazdirirken kart iki sayfaya bolunmez (Figma: 08 Yeni Stil (A) > kart)
export const PANEL_CLASS = "space-y-4 surface p-5 break-inside-avoid md:p-6";
export const PANEL_TITLE_CLASS = "text-base font-semibold";
export const PANEL_SUBTITLE_CLASS = "text-sm text-muted-foreground";

// Kartin alt bilgisi: ince cizginin altinda kucuk not (ornek: "Tipik sure: ..."); kartin kenarina uzanir
export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 -mb-5 border-t px-5 py-3 text-[13px] text-muted-foreground md:-mx-6 md:-mb-6 md:px-6">
      {children}
    </div>
  );
}

interface ChartCardProps {
  // Baslik sorunun cevabini soyler ("En cok sorun: Temizlik"), alt baslik neyin cizildigini
  title: string;
  subtitle: string;
  className?: string;
  // Kartin altinda cizgiyle ayrilan not
  footer?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, className, footer, children }: ChartCardProps) {
  return (
    <section className={cn(PANEL_CLASS, "flex flex-col", className)}>
      <div className="space-y-0.5">
        <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
        <p className={PANEL_SUBTITLE_CLASS}>{subtitle}</p>
      </div>
      <div className="flex-1 space-y-3.5">{children}</div>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </section>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-30 items-center justify-center text-center text-sm text-muted-foreground md:min-h-48">
      {children}
    </p>
  );
}

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(PANEL_CLASS, className)}>
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
