"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealth } from "@/hooks/useHealth";
import { describeHealth, type HealthLine, type HealthTone } from "@/lib/health";

const TONE_CLASS: Record<HealthTone, string> = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};

function StatusLine({ line }: { line: HealthLine }) {
  return (
    <p className="flex items-center gap-2">
      <span aria-hidden className={`size-2 rounded-full ${TONE_CLASS[line.tone]}`} />
      <span data-tone={line.tone}>{line.label}</span>
    </p>
  );
}

export function HealthStatus() {
  const { isPending, error } = useHealth();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Sistem durumu kontrol ediliyor…</p>;
  }

  const view = describeHealth(error);
  const hasError = view.backend.tone === "error" || view.database.tone === "error";
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Sistem durumu</CardTitle>
      </CardHeader>
      <CardContent role={hasError ? "alert" : "status"} className="space-y-1 text-sm">
        <StatusLine line={view.backend} />
        <StatusLine line={view.database} />
      </CardContent>
    </Card>
  );
}
