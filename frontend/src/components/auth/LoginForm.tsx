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
import { safeReturnPath } from "@/lib/loginReturn";

// Backend'in Turkce mesaji (yanlis parola, cok fazla deneme) aynen gosterilir; ag hatasinda kendi mesajimiz
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
}

function useLogin(next: string | undefined) {
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
      // Yalniz QR'in actigi bildirim formuna geri donulur; baska "next" adresi ana sayfaya gider (lib/loginReturn.ts)
      router.replace(safeReturnPath(next));
    } catch (caught: unknown) {
      setError(messageFor(caught));
      setPending(false);
    }
  }

  return { error, pending, submit };
}

// Her ekranda 44 px alan ve 16 px yazi: telefonda dokunma hedefi ve iOS otomatik zoom'u,
// masaustunde giris kutusu okunakli olsun diye ayni boy
const FIELD_CLASS = "h-11 text-base";

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
      <CircleAlertIcon aria-hidden className="mt-px size-[18px] shrink-0" />
      {message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { error, pending, submit } = useLogin(next);

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error && <ErrorAlert message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[15px]">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className={FIELD_CLASS} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[15px]">Parola</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD_CLASS}
        />
      </div>
      <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
