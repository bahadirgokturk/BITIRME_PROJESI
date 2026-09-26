"use client";

import type { ReactNode } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { AppShell } from "./AppShell";

// Menu, giris yapan kullanicinin rolune gore cizilir; rol tahmin edilmez (KOD_KURALLARI kural 1)
export function CurrentUserShell({ children }: { children: ReactNode }) {
  const { data: user, isPending, error } = useCurrentUser();

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  // Arka plan yenilemesi basarisiz olsa da bilinen kullanici gosterilmeye devam eder;
  // hata yalniz hic veri yokken tam ekran gosterilir
  if (!user) {
    return (
      <p role="alert" className="p-6 text-sm">
        Kullanıcı bilgisi alınamadı: {error?.message}
      </p>
    );
  }
  return (
    <AppShell role={user.role} userName={user.full_name}>
      {children}
    </AppShell>
  );
}
