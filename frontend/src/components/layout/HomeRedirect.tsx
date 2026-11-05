"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { homePathFor } from "@/lib/navigation";

// "/" adresi: kullanicinin rolune ait ilk sayfaya gider (giris de "/"a yonlendirir).
// Yonlendirme bitene kadar bir sey cizilmez. Oturum hatalarini CurrentUserShell ele alir.
export function HomeRedirect() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const target = user ? homePathFor(user.role) : null;

  useEffect(() => {
    if (target) {
      router.replace(target);
    }
  }, [router, target]);

  return null;
}
