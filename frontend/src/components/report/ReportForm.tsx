"use client";

import { useState, type FormEvent } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { useCreateReport } from "@/hooks/useReport";
import { addFiles, DESCRIPTION_MAX_LENGTH, descriptionProblem } from "@/lib/report";

import { AttachmentField } from "./AttachmentField";
import { LocationField } from "./LocationField";

const DESCRIPTION_ID = "report-description";
const DESCRIPTION_HINT_ID = "report-description-hint";
const LOCATION_REQUIRED = "Konum seçmelisiniz.";

interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

function DescriptionField({ value, onChange, error }: DescriptionFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={DESCRIPTION_ID}>Ne oldu?</Label>
      <Textarea
        id={DESCRIPTION_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="B blok 2. kat erkek tuvalette sabun bitmiş"
        aria-invalid={error ? true : undefined}
        aria-describedby={DESCRIPTION_HINT_ID}
        className="min-h-30 text-base md:text-base"
      />
      <div id={DESCRIPTION_HINT_ID} className="flex justify-between gap-2 text-xs">
        <span className={error ? "text-destructive" : "text-muted-foreground"}>{error ?? "En az 10 karakter"}</span>
        <span className="text-muted-foreground">
          {value.trim().length}/{DESCRIPTION_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}

function ReportIntro() {
  return (
    <div className="space-y-3">
      <PageTitle>Bildirim yap</PageTitle>
      <p className="text-sm text-muted-foreground">
        Ne olduğunu ve nerede olduğunu yaz; kategori seçmene gerek yok, ilgili birime biz yönlendiririz.
      </p>
    </div>
  );
}

// Eklenen dosyalar ve son secimdeki sorun (ornegin desteklenmeyen tur)
function useFileList() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  return {
    files,
    problem,
    pick(picked: File[]) {
      const selection = addFiles(files, picked);
      setFiles(selection.files);
      setProblem(selection.problem);
    },
    remove(index: number) {
      setFiles(files.filter((_, i) => i !== index));
    },
  };
}

// Kategori/oncelik alani yok: onlari agent'lar belirler (docs/UI_GUIDE.md bolum 1 ve 5.1)
export function ReportForm({ mutation }: { mutation: ReturnType<typeof useCreateReport> }) {
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState("");
  const fileList = useFileList();
  // Hatalar ilk gonderme denemesinden sonra gosterilir; kullanici yazarken kizarmasin
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (descriptionProblem(description) !== null || locationId === "") {
      return;
    }
    mutation.mutate({ description, locationId: Number(locationId), files: fileList.files });
  }

  return (
    <form noValidate onSubmit={submit} className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <ReportIntro />
      <div className="flex flex-col gap-5 md:rounded-xl md:border md:p-8">
        <DescriptionField
          value={description}
          onChange={setDescription}
          error={submitted ? descriptionProblem(description) : null}
        />
        <LocationField
          value={locationId}
          onChange={setLocationId}
          error={submitted && locationId === "" ? LOCATION_REQUIRED : null}
        />
        <AttachmentField files={fileList.files} problem={fileList.problem} onPick={fileList.pick} onRemove={fileList.remove} />
        <FormAlert error={mutation.error} />
        <Button type="submit" className="h-12 w-full md:w-auto md:self-end md:px-6" disabled={mutation.isPending}>
          {mutation.isPending ? "Gönderiliyor…" : "Gönder"}
        </Button>
      </div>
    </form>
  );
}
