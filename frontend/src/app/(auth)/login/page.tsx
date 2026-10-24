import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Giriş · BakırçayFlow" };

// Gorunum LoginScreen'de (Figma), giris mantigi LoginForm'da. ?next= yalniz QR formu icin kullanilir
// (lib/loginReturn.ts); searchParams Next.js 16'da Promise
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <LoginScreen next={typeof next === "string" ? next : undefined} />;
}
