"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { homePathFor } from "@/lib/navigation";

// "/" adresi: kullanicinin rolune ait ilk sayfaya gider (giris de "/"a yonlendirir).
// Rolun ekrani yoksa gecici icerik (children) gosterilir. Oturum hatalarini CurrentUserShell ele alir.
export function HomeRedirect({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const target = user ? homePathFor(user.role) : null;

  useEffect(() => {
    if (target) {
      router.replace(target);
    }
  }, [router, target]);

  if (!user || target) {
    return null;
  }
  return children;
}
