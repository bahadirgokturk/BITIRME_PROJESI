import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Giriş · CampusFlow AI" };

// Gorunum Figma tasarimi gelince (campusflow-screen skill'i) guncellenebilir; mantik LoginForm'da
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Giriş yap</CardTitle>
          <CardDescription>Kampüs hesabınızla giriş yapın.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
