import {
  ChartColumnIcon,
  Building2Icon,
  FileTextIcon,
  HomeIcon,
  InboxIcon,
  ListChecksIcon,
  ListIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { cn } from "cn";

import type { NavGroup, NavItem } from "@/lib/navigation";

// Masaustu kenar cubugunda 36 px, telefon panelinde 44 px dokunma alani (UI_GUIDE bolum 8)
const SIZE_CLASS = {
  desktop: "h-9 text-sm",
  mobile: "h-11 text-[15px]",
} as const;

const LINK_CLASS =
  "flex items-center gap-2 rounded-md px-2 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

// Her menu ogesinin simgesi (Figma: 08 Yeni Stil (A) > kenar cubugu); bilinmeyen adreste simge yok
const NAV_ICONS: Record<string, LucideIcon> = {
  "/report": PlusIcon,
  "/my-cases": FileTextIcon,
  "/staff/tasks": ListChecksIcon,
  "/staff/cases": ListIcon,
  "/manager/dashboard": HomeIcon,
  "/manager/review-queue": InboxIcon,
  "/manager/analytics": ChartColumnIcon,
  "/manager/departments": Building2Icon,
  "/manager/agents": SparklesIcon,
  "/manager/cases": ListIcon,
  "/admin": SettingsIcon,
};

interface NavListProps {
  items: NavItem[];
  activeHref: string | null;
  size: keyof typeof SIZE_CLASS;
  onNavigate?: () => void;
}

// Secili sayfa: vurgulu zemin + kalin yazi + aria-current (durum yalniz renkle anlatilmaz)
function NavList({ items, activeHref, size, onNavigate }: NavListProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = NAV_ICONS[item.href];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                LINK_CLASS,
                SIZE_CLASS[size],
                active && "bg-accent font-medium text-accent-foreground",
              )}
            >
              {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavLinks(props: NavListProps) {
  return (
    <nav aria-label="Ana menü">
      <NavList {...props} />
    </nav>
  );
}

function NavGroupSection({ group, activeHref }: { group: NavGroup; activeHref: string | null }) {
  const titleId = useId();
  if (group.title === null) {
    return <NavList items={group.items} activeHref={activeHref} size="desktop" />;
  }
  return (
    <div role="group" aria-labelledby={titleId}>
      <p id={titleId} className="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground">
        {group.title}
      </p>
      <NavList items={group.items} activeHref={activeHref} size="desktop" />
    </div>
  );
}

// Masaustu kenar cubugu: menu basliklarla gruplanir (lib/navigation.ts navGroupsFor)
export function GroupedNavLinks({ groups, activeHref }: { groups: NavGroup[]; activeHref: string | null }) {
  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-3">
      {groups.map((group) => (
        <NavGroupSection key={group.title ?? "menu"} group={group} activeHref={activeHref} />
      ))}
    </nav>
  );
}
