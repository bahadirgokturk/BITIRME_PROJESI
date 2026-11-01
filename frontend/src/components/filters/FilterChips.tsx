import { cn } from "cn";

interface FilterChipsProps<T extends string> {
  label: string;
  // Sayi verilirse etiketin yaninda kucuk bir hapta yazilir ("Tumu 3")
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}

// Gri zeminde gecisli sekme grubu (Figma: 08 Yeni Stil (A)); secili sekme beyaz ve golgeli.
// Telefonda 44 px dokunma alani, sigmazsa yana kayar. Secili olan aria-pressed ile de bildirilir (UI_GUIDE bolum 8)
const GROUP_CLASS = "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-1";
const OPTION_CLASS =
  "h-11 shrink-0 rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors " +
  "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8";
const COUNT_CLASS = "ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-medium text-foreground";
const SELECTED_CLASS = "bg-background font-medium text-foreground shadow-xs";

export function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={GROUP_CLASS}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(OPTION_CLASS, option.value === value && SELECTED_CLASS)}
        >
          {option.label}
          {option.count === undefined ? null : (
            <>
              {" "}
              <span className={COUNT_CLASS}>{option.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
