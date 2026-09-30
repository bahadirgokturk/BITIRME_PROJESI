import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Giriş · CampusFlow AI" };

// Gorunum LoginScreen'de (Figma), giris mantigi LoginForm'da
export default function LoginPage() {
  return <LoginScreen />;
}
