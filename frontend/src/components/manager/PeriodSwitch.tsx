import { cn } from "cn";

import { PERIODS, type SummaryPeriod } from "@/lib/analytics";

interface PeriodSwitchProps {
  value: SummaryPeriod;
  onChange: (period: SummaryPeriod) => void;
}

// Mudur ekranlarinin ortak donem dugmesi (Son 7 gun / Son 30 gun)
export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <div role="group" aria-label="Dönem" className="flex rounded-lg bg-muted p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          aria-pressed={period.value === value}
          onClick={() => onChange(period.value)}
          className={cn(
            "h-11 flex-1 rounded-md px-3.5 text-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
            period.value === value && "border bg-background font-medium text-foreground",
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
