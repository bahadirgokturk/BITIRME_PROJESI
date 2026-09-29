"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/session";

// Backend'in Turkce mesaji (yanlis parola, cok fazla deneme) aynen gosterilir; ag hatasinda kendi mesajimiz
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
}

function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      // Onceki oturumdan kalan kullanici verisi yeni kullaniciya gosterilmesin
      queryClient.clear();
      // Sabit adres: kullanicidan gelen bir "next" adresine yonlendirilmez (acik yonlendirme riski)
      router.replace("/");
    } catch (caught: unknown) {
      setError(messageFor(caught));
      setPending(false);
    }
  }

  return { error, pending, submit };
}

export function LoginForm() {
  const { error, pending, submit } = useLogin();

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Parola</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
