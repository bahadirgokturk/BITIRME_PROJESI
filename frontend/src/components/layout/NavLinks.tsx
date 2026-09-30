import Link from "next/link";

import { cn } from "cn";

import type { NavItem } from "@/lib/navigation";

// Masaustu kenar cubugunda 40 px, telefon panelinde 44 px dokunma alani (UI_GUIDE bolum 8)
const SIZE_CLASS = {
  desktop: "h-10 text-sm",
  mobile: "h-11 text-[15px]",
} as const;

interface NavLinksProps {
  items: NavItem[];
  activeHref: string | null;
  size: keyof typeof SIZE_CLASS;
  onNavigate?: () => void;
}

// Secili sayfa: vurgulu zemin + turuncu marka cizgisi + aria-current (durum yalniz renkle anlatilmaz)
export function NavLinks({ items, activeHref, size, onNavigate }: NavLinksProps) {
  return (
    <nav aria-label="Ana menü">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  SIZE_CLASS[size],
                  active && "bg-accent font-medium text-accent-foreground",
                )}
              >
                {active ? <span aria-hidden className="h-4 w-[3px] rounded-[2px] bg-brand-accent" /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
