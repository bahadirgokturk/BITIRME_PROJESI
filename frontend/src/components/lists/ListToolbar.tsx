"use client";

import { LayoutGridIcon, ListIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "cn";

import { CheckboxFilter } from "@/components/filters/CheckboxFilter";
import {
  PRIORITY_FILTER_OPTIONS,
  priorityFilterSummary,
  type ListOrder,
  type ListTools,
  type ListView,
  type OrderOption,
} from "@/lib/listTools";
import type { Priority } from "@/lib/tasks";

const SELECT_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";
const VIEW_BUTTON_CLASS =
  "inline-flex size-10 items-center justify-center rounded-md text-muted-foreground outline-none " +
  "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground";

const VIEWS: { value: ListView; label: string; Icon: typeof ListIcon }[] = [
  { value: "list", label: "Liste görünümü", Icon: ListIcon },
  { value: "grid", label: "Kart görünümü", Icon: LayoutGridIcon },
];

// Liste ya da kare kart: secili olan aria-pressed ile soylenir, simge tek basina anlam tasimaz (UI_GUIDE bolum 8)
export function ViewToggle({ value, onChange }: { value: ListView; onChange: (view: ListView) => void }) {
  return (
    <div role="group" aria-label="Görünüm" className="flex shrink-0 gap-0.5 rounded-lg border p-0.5">
      {VIEWS.map(({ value: view, label, Icon }) => (
        <button
          key={view}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={view === value}
          onClick={() => onChange(view)}
          className={VIEW_BUTTON_CLASS}
        >
          <Icon aria-hidden className="size-[18px]" />
        </button>
      ))}
    </div>
  );
}

interface ListToolbarProps {
  tools: ListTools;
  orders: readonly OrderOption[];
  view: ListView;
  onTools: (tools: ListTools) => void;
  onView: (view: ListView) => void;
  // Gorunum dugmelerinin solunda ek arac (ornek: Excel'e aktar)
  extra?: ReactNode;
}

// Oncelik (tikli), siralama ve gorunum; telefonda tek satirda filtre genisler, masaustunde gorunum sagda durur
// (Figma: ListToolbar; /my-cases, /staff/tasks, /manager/cases - liste araclari / kart gorunumu)
export function ListToolbar({ tools, orders, view, onTools, onView, extra }: ListToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-2 *:min-w-0 max-md:*:first:flex-1 md:flex-none">
        <CheckboxFilter
          label="Öncelik"
          summary={priorityFilterSummary(tools.priorities)}
          options={PRIORITY_FILTER_OPTIONS}
          selected={tools.priorities}
          onChange={(priorities) => onTools({ ...tools, priorities: priorities as Priority[] })}
        />
        <select
          aria-label="Sıralama"
          value={tools.order}
          onChange={(event) => onTools({ ...tools, order: event.target.value as ListOrder })}
          className={cn(SELECT_CLASS, "w-28 md:w-40")}
        >
          {orders.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-start gap-2 md:ml-auto">
        {extra}
        <ViewToggle value={view} onChange={onView} />
      </div>
    </div>
  );
}
