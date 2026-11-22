"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useImportUsers, type ImportResult } from "@/hooks/useAdminUsers";
import { errorSummary, IMPORT_TEMPLATE_HREF, importProblems, type ImportForm } from "@/lib/userImport";

import { Field } from "./Field";

const COLUMNS_NOTE =
  "Excel'de \"CSV UTF-8\" ya da \"CSV\" olarak kaydedin. Sütunlar: email, full_name, role; " +
  "bildirim yapanlar için reporter_kind, personel ve müdürler için department_code.";
// Tarayicinin kendi dosya dugmesi Ingilizce yazar ("Choose File"); input gizlenir, kutu Turkce cizilir
const FILE_BOX_CLASS =
  "flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-3 text-base " +
  "has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 has-[input[aria-invalid]]:border-destructive";
const LINK_CLASS =
  "inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-primary-text underline-offset-4 " +
  "outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

// Hatali satirlar Excel satir numarasiyla (baslik 1. satir); hicbiri eklenmez
function ImportErrors({ errors }: { errors: ImportResult["errors"] }) {
  return (
    <div className="space-y-2">
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
        {errorSummary(errors.length)}
      </p>
      <div className="max-h-60 overflow-y-auto rounded-lg border">
        <table aria-label="Hatalı satırlar" className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-16 px-3 py-2 font-medium">Satır</th>
              <th className="px-3 py-2 font-medium">Sorun</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((error) => (
              <tr key={`${error.row}-${error.message}`} className="border-t">
                <td className="px-3 py-2 tabular-nums">{error.row}</td>
                <td className="px-3 py-2">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FieldsProps {
  form: ImportForm;
  problems: Partial<Record<keyof ImportForm, string>>;
  onChange: (form: ImportForm) => void;
}

function ImportFields({ form, problems, onChange }: FieldsProps) {
  return (
    <>
      <Field label="CSV dosyası" error={problems.file}>
        {(control) => (
          <label className={FILE_BOX_CLASS}>
            <input
              {...control}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onChange({ ...form, file: event.target.files?.[0] ?? null })}
              className="sr-only"
            />
            <span className="shrink-0 font-medium">Dosya seç</span>
            <span className="truncate text-sm text-muted-foreground">{form.file?.name ?? "Dosya seçilmedi"}</span>
          </label>
        )}
      </Field>
      <Field
        label="Ortak geçici parola"
        error={problems.password}
        hint="Herkes bu parolayla girer ve ilk girişte kendi parolasını belirler."
      >
        {(control) => (
          <Input
            {...control}
            type="text"
            autoComplete="off"
            value={form.password}
            onChange={(event) => onChange({ ...form, password: event.target.value })}
            className="h-11 text-base"
          />
        )}
      </Field>
    </>
  );
}

// Kontrol sonucu: hata yoksa eklenecek sayi ve ekleme dugmesi, varsa hatali satirlar
function CheckResult({ result, pending, onImport }: { result: ImportResult; pending: boolean; onImport: () => void }) {
  if (result.errors.length > 0) {
    return <ImportErrors errors={result.errors} />;
  }
  return (
    <div className="space-y-3">
      <p role="status" className="rounded-md bg-muted px-3 py-2.5 text-sm">
        Dosyada hata yok: {result.created} kullanıcı eklenecek.
      </p>
      <Button type="button" className="h-11 w-full" disabled={pending} onClick={onImport}>
        {pending ? "Ekleniyor…" : `${result.created} kullanıcıyı ekle`}
      </Button>
    </div>
  );
}

// Once dry_run ile kontrol, hata yoksa ayni dosya ve parolayla gercek yukleme (hepsi ya da hicbiri)
function ImportBody({ onDone }: { onDone: (message: string) => void }) {
  const [form, setForm] = useState<ImportForm>({ file: null, password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [checked, setChecked] = useState<ImportResult | null>(null);
  const importUsers = useImportUsers();
  const problems = submitted ? importProblems(form) : {};

  function change(next: ImportForm) {
    setForm(next);
    setChecked(null);
    importUsers.reset();
  }
  function run(dryRun: boolean) {
    importUsers.mutate(
      { file: form.file!, password: form.password, dryRun },
      {
        onSuccess: (result) => (dryRun || result.errors.length > 0 ? setChecked(result) : onDone(doneMessage(result))),
      },
    );
  }
  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(importProblems(form)).length === 0) {
      run(true);
    }
  }

  return (
    <form noValidate onSubmit={check} className="space-y-4">
      <ImportFields form={form} problems={problems} onChange={change} />
      <FormAlert error={importUsers.error} />
      {checked ? <CheckResult result={checked} pending={importUsers.isPending} onImport={() => run(false)} /> : null}
      {checked ? null : (
        <Button type="submit" variant="outline" className="h-11 w-full" disabled={importUsers.isPending}>
          {importUsers.isPending ? "Kontrol ediliyor…" : "Dosyayı kontrol et"}
        </Button>
      )}
    </form>
  );
}

function doneMessage(result: ImportResult): string {
  return `${result.created} kullanıcı eklendi. İlk girişte kendi parolalarını belirleyecekler.`;
}

// Yonetim > Kullanicilar > "Toplu yukle (CSV)" (docs/API.md "Toplu yukleme")
export function UserImportDialog({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-11 gap-1.5 px-4 md:h-10" />}>
        <UploadIcon aria-hidden className="size-4" />
        Toplu yükle (CSV)
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-[520px]">
        <DialogTitle className="text-lg font-semibold">Toplu yükle (CSV)</DialogTitle>
        <DialogDescription>{COLUMNS_NOTE}</DialogDescription>
        <a href={IMPORT_TEMPLATE_HREF} download className={LINK_CLASS}>
          <DownloadIcon aria-hidden className="size-4" />
          Örnek dosyayı indir
        </a>
        {/* Pencere her acilista bos formla baslar */}
        {open ? (
          <ImportBody
            onDone={(message) => {
              setOpen(false);
              onDone(message);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
