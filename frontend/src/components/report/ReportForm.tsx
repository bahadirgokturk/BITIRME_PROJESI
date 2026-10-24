"use client";

import { useState, type FormEvent } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQrLocation, type useCreateReport } from "@/hooks/useReport";
import { clearReportDraft, readReportDraft, useSaveReportDraft } from "@/hooks/useReportDraft";
import { ApiError } from "@/lib/api/client";
import { addFiles, DESCRIPTION_MAX_LENGTH, descriptionProblem, qrLocationId } from "@/lib/report";
import { draftForForm } from "@/lib/reportDraft";

import { AttachmentField } from "./AttachmentField";
import { DraftNotice } from "./DraftNotice";
import { LocationField } from "./LocationField";

const DESCRIPTION_ID = "report-description";
const DESCRIPTION_HINT_ID = "report-description-hint";
const LOCATION_REQUIRED = "Konum seçmelisiniz.";
const QR_HINT = "QR koddan seçildi. Başka bir yerse Değiştir'e basın.";
const QR_NOT_FOUND = "QR koddaki konum bulunamadı ya da artık kullanılmıyor. Konumu aşağıdan arayın.";
const NOT_FOUND_STATUS = 404;

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
      <PageTitle>Bildirim Yap</PageTitle>
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
    reset() {
      setFiles([]);
      setProblem(null);
    },
  };
}

// Kapidaki QR'in konumu (?location=<id>), kullanici baska bir yer secene kadar secili kalir; konum yoksa
// (pasif, baska kurum ya da bozuk kod) bir not gosterilir ve konum elle aranir
function useQrChoice(qrLocation: string | undefined) {
  const id = qrLocation === undefined ? null : qrLocationId(qrLocation);
  const query = useQrLocation(id);
  const [dismissed, setDismissed] = useState(false);
  const active = qrLocation !== undefined && !dismissed;
  const missing = id === null || (query.error instanceof ApiError && query.error.status === NOT_FOUND_STATUS);
  return {
    location: active ? query.data : undefined,
    notFound: active && missing,
    dismiss: () => setDismissed(true),
  };
}

// Taslak yoksa alanlar bos baslar
function draftStart(draft: ReturnType<typeof readReportDraft>) {
  return { description: draft?.description ?? "", locationId: draft?.locationId ?? "", hadFiles: draft?.hadFiles ?? false };
}

// Aciklama ve konum taslaktan baslar ve degistikce taslaga yazilir (hooks/useReportDraft.ts)
function useReportFields(draftKey: string | null, fileList: ReturnType<typeof useFileList>, qrLocation?: string) {
  const [restored, setRestored] = useState(() => draftForForm(readReportDraft(draftKey), qrLocation !== undefined));
  const start = draftStart(restored);
  const [description, setDescription] = useState(start.description);
  const [pickedId, setPickedId] = useState(start.locationId);
  const qr = useQrChoice(qrLocation);
  const locationId = qr.location ? String(qr.location.id) : pickedId;
  // Geri yuklenen taslakta dosya vardiysa, yenisi eklenmese de hatirlatma bir sonraki acilista da kalir
  const hadFiles = fileList.files.length > 0 || start.hadFiles;
  useSaveReportDraft(draftKey, { description, locationId, hadFiles });
  return {
    description,
    setDescription,
    locationId,
    setLocationId(id: string) {
      qr.dismiss();
      setPickedId(id);
    },
    qr,
    restored,
    discard() {
      setDescription("");
      setPickedId("");
      qr.dismiss();
      setRestored(null);
      fileList.reset();
      clearReportDraft(draftKey);
    },
  };
}

interface ReportFormProps {
  mutation: ReturnType<typeof useCreateReport>;
  draftKey: string | null;
  qrLocation?: string;
}

// Kategori/oncelik alani yok: onlari agent'lar belirler (docs/UI_GUIDE.md bolum 1 ve 5.1)
export function ReportForm({ mutation, draftKey, qrLocation }: ReportFormProps) {
  const fileList = useFileList();
  const fields = useReportFields(draftKey, fileList, qrLocation);
  const { description, locationId } = fields;
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
      {fields.restored ? <DraftNotice hadFiles={fields.restored.hadFiles} onDiscard={fields.discard} /> : null}
      <div className="flex flex-col gap-5 md:rounded-xl md:border md:p-8">
        <DescriptionField
          value={description}
          onChange={fields.setDescription}
          error={submitted ? descriptionProblem(description) : null}
        />
        <LocationField
          value={locationId}
          onChange={fields.setLocationId}
          error={submitted && locationId === "" ? LOCATION_REQUIRED : null}
          known={fields.qr.location}
          hint={fields.qr.location ? QR_HINT : null}
          notice={fields.qr.notFound ? QR_NOT_FOUND : null}
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
