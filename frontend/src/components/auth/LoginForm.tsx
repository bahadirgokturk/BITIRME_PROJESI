"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
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

// Telefonda 44 px alan ve 16 px yazi (dokunma hedefi, iOS otomatik zoom'u), masaustunde varsayilan boy
const FIELD_CLASS = "h-11 text-base md:h-8 md:text-sm";

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
      <CircleAlertIcon aria-hidden className="mt-px size-[18px] shrink-0" />
      {message}
    </p>
  );
}

export function LoginForm() {
  const { error, pending, submit } = useLogin();

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error && <ErrorAlert message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className={FIELD_CLASS} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Parola</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD_CLASS}
        />
      </div>
      <Button type="submit" className="h-11 w-full md:h-9" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
