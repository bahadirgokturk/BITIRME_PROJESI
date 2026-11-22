"use client";

import { useState, type FormEvent } from "react";

import { Field } from "@/components/admin/Field";
import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/hooks/usePassword";
import {
  passwordProblems,
  PASSWORD_MIN_LENGTH,
  type PasswordForm as Form,
  type PasswordProblems,
} from "@/lib/password";

const EMPTY: Form = { current: "", next: "", repeat: "" };

interface InputsProps {
  form: Form;
  problems: PasswordProblems;
  currentLabel: string;
  onChange: (form: Form) => void;
}

interface PasswordInputProps {
  label: string;
  error?: string;
  hint?: string;
  value: string;
  // Tarayicinin parola yoneticisi icin: mevcut ve yeni parola ayri tanitilir
  autoComplete: "current-password" | "new-password";
  onChange: (value: string) => void;
}

function PasswordInput({ label, error, hint, value, autoComplete, onChange }: PasswordInputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <Input
          {...control}
          type="password"
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 text-base"
        />
      )}
    </Field>
  );
}

function PasswordInputs({ form, problems, currentLabel, onChange }: InputsProps) {
  const set = (key: keyof Form) => (value: string) => onChange({ ...form, [key]: value });
  return (
    <>
      <PasswordInput
        label={currentLabel}
        error={problems.current}
        value={form.current}
        autoComplete="current-password"
        onChange={set("current")}
      />
      <PasswordInput
        label="Yeni parola"
        error={problems.next}
        hint={`En az ${PASSWORD_MIN_LENGTH} karakter.`}
        value={form.next}
        autoComplete="new-password"
        onChange={set("next")}
      />
      <PasswordInput
        label="Yeni parola (tekrar)"
        error={problems.repeat}
        value={form.repeat}
        autoComplete="new-password"
        onChange={set("repeat")}
      />
    </>
  );
}

interface PasswordFormProps {
  // "Mevcut parola" ya da ilk giriste "Gecici parola"
  currentLabel: string;
  onDone: () => void;
}

// Kendi parolasini degistirme formu (POST /auth/password): kurallar once tarayicida, sonra backend mesaji
export function PasswordForm({ currentLabel, onDone }: PasswordFormProps) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const change = useChangePassword();
  const problems = submitted ? passwordProblems(form) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(passwordProblems(form)).length === 0) {
      change.mutate({ current: form.current, next: form.next }, { onSuccess: onDone });
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <PasswordInputs form={form} problems={problems} currentLabel={currentLabel} onChange={setForm} />
      <FormAlert error={change.error} />
      <Button type="submit" className="h-11 w-full text-base" disabled={change.isPending}>
        {change.isPending ? "Kaydediliyor…" : "Parolayı kaydet"}
      </Button>
    </form>
  );
}
