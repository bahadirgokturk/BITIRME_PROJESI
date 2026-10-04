import type { ReactNode } from "react";

import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

export const PANEL_CLASS = "space-y-3.5 rounded-lg border bg-card p-4 md:p-5";

interface ChartCardProps {
  // Baslik sorunun cevabini soyler ("En cok sorun: Temizlik"), alt baslik neyin cizildigini
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, className, children }: ChartCardProps) {
  return (
    <section className={cn(PANEL_CLASS, className)}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
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
