"use client";

import { useState, type FormEvent } from "react";

import { cn } from "cn";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUpdateAgentPolicy } from "@/hooks/useAdminAgentPolicies";
import {
  agentPolicyFormProblems,
  AUTONOMY_LABELS,
  AUTONOMY_NOTES,
  formFromAgentPolicy,
  toAgentPolicyBody,
  type AgentPolicyForm,
  type AgentPolicyRow,
  type AutonomyLevel,
} from "@/lib/adminAgentPolicies";

import { HistoryLink, SHEET_CLASS } from "../AdminParts";
import { Field } from "../Field";

const LEVELS = Object.keys(AUTONOMY_LABELS) as AutonomyLevel[];
// 0-100 arasi en cok uc hane
const PERCENT_MAX_DIGITS = 3;

interface AgentPolicySheetProps {
  row: AgentPolicyRow;
  onClose: () => void;
  onDone: (message: string) => void;
}

// Uc secenek aciklamasiyla birlikte gorunur: yonetici neyi sectigini okuyarak anlar (Figma: RadioGroup)
function AutonomyChoice({ value, onChange }: { value: AutonomyLevel; onChange: (level: AutonomyLevel) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium">Karar yetkisi</legend>
      {LEVELS.map((level) => (
        <label
          key={level}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            level === value && "border-primary",
          )}
        >
          <input
            type="radio"
            name="autonomy-level"
            checked={level === value}
            onChange={() => onChange(level)}
            className="mt-0.5 size-[18px] shrink-0 accent-primary"
          />
          <span className="text-sm font-medium">
            {AUTONOMY_LABELS[level]}
            <span className="block text-xs font-normal text-muted-foreground">{AUTONOMY_NOTES[level]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

interface FieldsProps {
  form: AgentPolicyForm;
  error?: string;
  onChange: (form: AgentPolicyForm) => void;
}

function PolicyFields({ form, error, onChange }: FieldsProps) {
  return (
    <>
      <AutonomyChoice value={form.autonomy_level} onChange={(autonomy_level) => onChange({ ...form, autonomy_level })} />
      <Field
        label="Güven eşiği (%)"
        error={error}
        hint="Yapay zekânın güveni bu değerin altındaysa bildirim müdürün incelemesine gider (0–100)."
      >
        {(c) => (
          <Input
            {...c}
            inputMode="numeric"
            maxLength={PERCENT_MAX_DIGITS}
            value={form.confidence_pct}
            onChange={(event) => onChange({ ...form, confidence_pct: event.target.value })}
            className="h-11"
          />
        )}
      </Field>
    </>
  );
}

// Duzenleme paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > /admin/agent-policies - duzenleme paneli)
export function AgentPolicySheet({ row, onClose, onDone }: AgentPolicySheetProps) {
  const [form, setForm] = useState(() => formFromAgentPolicy(row.policy));
  const [submitted, setSubmitted] = useState(false);
  const update = useUpdateAgentPolicy(row.policy.id);
  const problems = submitted ? agentPolicyFormProblems(form) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(agentPolicyFormProblems(form)).length === 0) {
      update.mutate(toAgentPolicyBody(form), { onSuccess: () => onDone(`${row.name} politikası güncellendi.`) });
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className={SHEET_CLASS}>
        <SheetTitle className="text-lg font-semibold">Politikayı düzenle</SheetTitle>
        <SheetDescription>{row.name}</SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <PolicyFields form={form} error={problems.confidence_pct} onChange={setForm} />
          <FormAlert error={update.error} />
          <div className="mt-auto flex justify-end gap-2 pt-2">
            <HistoryLink entity="AGENT_POLICY" id={row.policy.id} />
            <SheetClose render={<Button type="button" variant="outline" className="h-11 px-4" />}>Vazgeç</SheetClose>
            <Button type="submit" className="h-11 px-4" disabled={update.isPending}>
              {update.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
