"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { LogoWordmark } from "@/components/brand/Logo";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePrintLightTheme } from "@/hooks/usePrintLightTheme";
import { activeNavHref, navigationFor, type Role } from "@/lib/navigation";
import { mobileBarFor } from "@/lib/shell";

import { MobileAppBar } from "./MobileAppBar";
import { NavLinks } from "./NavLinks";

interface AppShellProps {
  role: Role;
  userName: string;
  userDetail: string;
  children: ReactNode;
}

// Masaustunde sol kenar cubugu, telefonda ust cubuk + sol panel (Figma: AppSidebar, MobileAppBar)
export function AppShell({ role, userName, userDetail, children }: AppShellProps) {
  const pathname = usePathname();
  const items = navigationFor(role);
  const activeHref = activeNavHref(role, pathname);
  usePrintLightTheme();
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MobileAppBar
        bar={mobileBarFor(pathname)}
        items={items}
        activeHref={activeHref}
        user={{ name: userName, detail: userDetail }}
      />
      <aside className="hidden border-r bg-muted p-4 md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:flex-col md:gap-4 print:hidden">
        <div className="space-y-2">
          <LogoWordmark onMuted />
          <p className="text-xs text-muted-foreground">{userName}</p>
        </div>
        <div className="flex-1">
          <NavLinks items={items} activeHref={activeHref} size="desktop" />
        </div>
        {/* Cikis ve tema dugmesi menunun altinda yan yana (Figma: ManagerSidebar, ThemeToggle) */}
        <div className="flex items-center gap-1">
          {/* Cikis dugmesi kalan yeri kaplar; tema dugmesi menunun icinde kalir */}
          <div className="min-w-0 flex-1">
            <LogoutButton size="desktop" />
          </div>
          <ThemeToggle />
        </div>
      </aside>
      {/* Baglanti seridi icerik sutununun ustunde yapisik: telefonda ust cubugun (h-14) hemen alti */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner className="sticky top-14 md:top-0" />
        <main className="flex-1 p-4 md:px-8 md:py-10 print:p-0">{children}</main>
      </div>
    </div>
  );
}
