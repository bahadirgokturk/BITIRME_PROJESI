import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { LogoWordmark } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";
import type { NavItem } from "@/lib/navigation";
import type { MobileBar } from "@/lib/shell";

import { MobileMenu, type ShellUser } from "./MobileMenu";

interface MobileAppBarProps {
  bar: MobileBar;
  items: NavItem[];
  activeHref: string | null;
  user: ShellUser;
}

const ICON_BUTTON = buttonVariants({ variant: "ghost", className: "size-11" });

// Telefonda ustte sabit cubuk (PWA tam ekranda tarayici cubugu yok). Ana sayfalarda menu + logo,
// alt sayfalarda geri + baslik (Figma: MobileAppBar, Tur=Menu / Tur=Geri)
export function MobileAppBar({ bar, items, activeHref, user }: MobileAppBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b bg-background pr-4 pl-1.5 md:hidden">
      {bar.kind === "back" ? (
        <>
          <Link href={bar.backHref} aria-label="Geri" className={ICON_BUTTON}>
            <ArrowLeftIcon className="size-6" />
          </Link>
          <p className="text-lg font-semibold">{bar.title}</p>
        </>
      ) : (
        <>
          <MobileMenu items={items} activeHref={activeHref} user={user} />
          <LogoWordmark />
        </>
      )}
    </header>
  );
}
