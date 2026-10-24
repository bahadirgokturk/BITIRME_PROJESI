import { cn } from "cn";

interface FilterChipsProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Tek secimli filtre dugmeleri; secili olan aria-pressed ile de bildirilir (UI_GUIDE bolum 8)
export function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-11 rounded-full border bg-background px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
            option.value === value && "border-primary bg-primary font-medium text-primary-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
