"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { LogoWordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/navigation";

import { NavLinks } from "./NavLinks";

export interface ShellUser {
  name: string;
  detail: string;
}

interface MobileMenuProps {
  items: NavItem[];
  activeHref: string | null;
  user: ShellUser;
}

// Telefonda sol menu paneli (Figma: MobileMenuSheet); arkaplana dokununca ya da bir sayfa secilince kapanir
export function MobileMenu({ items, activeHref, user }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" className="size-11" aria-label="Menüyü aç" />}>
        <MenuIcon className="size-6" />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-5 bg-background pt-3 pr-2 pb-6 pl-4 data-[side=left]:w-[300px] data-[side=left]:max-w-[85vw]"
      >
        <div className="flex items-center justify-between">
          <LogoWordmark />
          <SheetClose render={<Button variant="ghost" className="size-11" aria-label="Menüyü kapat" />}>
            <XIcon className="size-6" />
          </SheetClose>
        </div>
        <SheetTitle className="sr-only">Menü</SheetTitle>
        <div className="space-y-0.5 pr-2">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.detail}</p>
        </div>
        <div className="flex-1 pr-2">
          <NavLinks items={items} activeHref={activeHref} size="mobile" onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t pt-5">
          <LogoutButton size="mobile" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
