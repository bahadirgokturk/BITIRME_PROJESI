"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealth } from "@/hooks/useHealth";
import { describeHealth, type HealthTone } from "@/lib/health";

const TONE_CLASS: Record<HealthTone, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function HealthStatus() {
  const { isPending, error } = useHealth();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Sistem durumu kontrol ediliyor…</p>;
  }

  const view = describeHealth(error);
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Sistem durumu</CardTitle>
      </CardHeader>
      <CardContent role={view.tone === "error" ? "alert" : "status"} className="space-y-1 text-sm">
        <p className="flex items-center gap-2">
          <span aria-hidden className={`size-2 rounded-full ${TONE_CLASS[view.tone]}`} />
          {view.backend}
        </p>
        <p className="pl-4">{view.database}</p>
      </CardContent>
    </Card>
  );
}
