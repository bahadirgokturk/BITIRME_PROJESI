"use client";

import { ChevronDownIcon } from "lucide-react";

import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterOption } from "@/lib/filters";

// cn ile birlestirilir: dugmenin seffaf varsayilan kenarligi silinir, kenarlik yandaki alanlar kadar gorunur
const TRIGGER_CLASS = cn(
  buttonVariants({ variant: "outline", className: "h-11 justify-between gap-2 font-normal md:h-10" }),
);

interface CheckboxFilterProps {
  // Ekran okuyucu icin listenin adi ("Birimler")
  label: string;
  // Dugmede yazan secim ozeti ("Birimler: Tumu", "Birimler: 2 secili")
  summary: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

// Tikli acilir pencere: birden fazla secenek isaretlenir, secim hemen uygulanir
// (Figma: 02 Components > CheckboxFilter). Bos secim "hepsi" demektir.
export function CheckboxFilter({ label, summary, options, selected, onChange }: CheckboxFilterProps) {
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER_CLASS}>
        {summary}
        <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-2">
        <div role="group" aria-label={label} className="grid gap-0.5">
          {options.map((option) => (
            <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 hover:bg-muted md:min-h-10">
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="min-h-11 rounded-md px-2 text-left text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-10"
          >
            Seçimi temizle
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
