"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ApiError } from "@/lib/api/client";
import { userDetail } from "@/lib/shell";

import { AppShell } from "./AppShell";

// Menu, giris yapan kullanicinin rolune gore cizilir; rol tahmin edilmez (KOD_KURALLARI kural 1)
export function CurrentUserShell({ children }: { children: ReactNode }) {
  const { data: user, isPending, error } = useCurrentUser();
  const router = useRouter();
  // Oturum yok ya da yenilenemedi (refresh cerezi de gecersiz): giris sayfasina
  const signedOut = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (signedOut) {
      router.replace("/login");
    }
  }, [signedOut, router]);

  if (isPending || signedOut) {
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
    <AppShell role={user.role} userName={user.full_name} userDetail={userDetail(user)}>
      {children}
    </AppShell>
  );
}
