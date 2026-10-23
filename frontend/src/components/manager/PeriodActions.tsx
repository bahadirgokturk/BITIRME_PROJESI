import { PrintButton } from "@/components/print/PrintButton";
import type { SummaryPeriod } from "@/lib/analytics";

import { PeriodSwitch } from "./PeriodSwitch";

interface PeriodActionsProps {
  value: SummaryPeriod;
  onChange: (period: SummaryPeriod) => void;
}

// Rapor ekranlarinin sag ust kosesi: donem secici + Yazdir. Kagitta ikisi de gizlenir (Figma: Actions)
export function PeriodActions({ value, onChange }: PeriodActionsProps) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <div className="flex-1 md:flex-none">
        <PeriodSwitch value={value} onChange={onChange} />
      </div>
      <PrintButton />
    </div>
  );
}
