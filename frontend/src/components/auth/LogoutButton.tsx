"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api/session";

// Menu ogeleriyle ayni yukseklik: masaustu 40 px, telefon paneli 44 px (Figma: MobileMenuSheet)
const SIZE_CLASS = {
  desktop: "h-10 text-sm",
  mobile: "h-11 text-[15px]",
} as const;

export function LogoutButton({ size }: { size: keyof typeof SIZE_CLASS }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await logout();
    } finally {
      // Cikis istegi basarisiz olsa da bu cihazdaki oturum ve onbellekteki veriler silinir
      queryClient.clear();
      router.replace("/login");
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      disabled={pending}
      className={`w-full justify-start gap-2.5 px-3 font-normal ${SIZE_CLASS[size]}`}
    >
      <LogOutIcon aria-hidden className="size-5" />
      Çıkış yap
    </Button>
  );
}
