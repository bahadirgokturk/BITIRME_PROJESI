"use client";

import { PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, type ReactNode } from "react";

import { cn } from "cn";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { LogoWordmark } from "@/components/brand/Logo";
import { WaitingBell } from "@/components/cases/WaitingBell";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePrintLightTheme } from "@/hooks/usePrintLightTheme";
import { useSidebarOpen } from "@/hooks/useSidebarOpen";
import { activeNavHref, navGroupsFor, navigationFor, sectionTitle, type Role } from "@/lib/navigation";
import { initialsOf, mobileBarFor } from "@/lib/shell";

import { MobileAppBar } from "./MobileAppBar";
import { GroupedNavLinks } from "./NavLinks";

const SIDEBAR_CLASS =
  "hidden p-3 md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:gap-4 print:hidden";
// Yazdirirken panel cercevesi ve bosluklari kalkar
const PANEL_CLASS =
  "flex min-w-0 flex-1 flex-col bg-background md:m-2 md:rounded-xl md:border md:shadow-xs " +
  "print:m-0 print:border-0 print:shadow-none";

interface AppShellProps {
  role: Role;
  userName: string;
  userDetail: string;
  children: ReactNode;
}

// Kenar cubugunun alti: giris yapan kisi ve cikis (Figma: 08 Yeni Stil (A) > kenar cubugu)
function AccountBox({ name, detail }: { name: string; detail: string }) {
  return (
    <section aria-label="Hesap" className="space-y-1 border-t pt-3">
      <div className="flex items-center gap-2 px-2 py-1">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">
          {initialsOf(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <LogoutButton size="desktop" />
    </section>
  );
}

const TOGGLE_CLASS =
  "-ml-2 grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent " +
  "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

interface SidebarToggle {
  open: boolean;
  controls: string;
  onToggle: () => void;
}

// Masaustunde icerik panelinin ustu: menu dugmesi, bolum adi, bildirim zili ve tema dugmesi
function DesktopTopBar({ title, sidebar }: { title: string | null; sidebar: SidebarToggle }) {
  return (
    <header
      aria-label="Sayfa çubuğu"
      className="hidden h-14 shrink-0 items-center gap-2 border-b px-6 md:flex print:hidden"
    >
      <button
        type="button"
        aria-label={sidebar.open ? "Menüyü gizle" : "Menüyü göster"}
        aria-expanded={sidebar.open}
        aria-controls={sidebar.controls}
        onClick={sidebar.onToggle}
        className={TOGGLE_CLASS}
      >
        <PanelLeftIcon aria-hidden className="size-[18px]" />
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <p className="text-[15px] font-medium">{title}</p>
      <div className="-mr-2 ml-auto flex items-center gap-1">
        <WaitingBell />
        <ThemeToggle />
      </div>
    </header>
  );
}

function Sidebar({ id, role, activeHref, userName, userDetail }: SidebarProps) {
  return (
    <aside id={id} className={SIDEBAR_CLASS}>
      <div className="px-2 pt-1.5">
        <LogoWordmark onMuted />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <GroupedNavLinks groups={navGroupsFor(role)} activeHref={activeHref} />
      </div>
      <AccountBox name={userName} detail={userDetail} />
    </aside>
  );
}

interface SidebarProps {
  id: string;
  role: Role;
  activeHref: string | null;
  userName: string;
  userDetail: string;
}

// Masaustunde gri kenar cubugu + yuvarlatilmis beyaz icerik paneli; telefonda ust cubuk + sol panel
// (Figma: 08 Yeni Stil (A), MobileAppBar)
export function AppShell({ role, userName, userDetail, children }: AppShellProps) {
  const pathname = usePathname();
  const activeHref = activeNavHref(role, pathname);
  const sidebarId = useId();
  const [sidebarOpen, toggleSidebar] = useSidebarOpen();
  usePrintLightTheme();
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row md:bg-sidebar print:bg-background">
      <MobileAppBar
        bar={mobileBarFor(pathname)}
        items={navigationFor(role)}
        activeHref={activeHref}
        user={{ name: userName, detail: userDetail }}
      />
      {/* Kapaliyken kenar cubugu hic cizilmez; icerik paneli tum genisligi alir */}
      {sidebarOpen ? (
        <Sidebar id={sidebarId} role={role} activeHref={activeHref} userName={userName} userDetail={userDetail} />
      ) : null}
      {/* Baglanti seridi icerik sutununun ustunde yapisik: telefonda ust cubugun (h-14) hemen alti */}
      <div className={cn(PANEL_CLASS, sidebarOpen && "md:ml-0")}>
        <DesktopTopBar
          title={sectionTitle(role, pathname)}
          sidebar={{ open: sidebarOpen, controls: sidebarId, onToggle: toggleSidebar }}
        />
        <OfflineBanner className="sticky top-14 md:top-0" />
        <main className="flex-1 p-4 md:px-8 md:py-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
