import { CircleCheckIcon } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { ReportResult, UploadFailure } from "@/hooks/useReport";

// Bildirim kayitli ama bazi dosyalari backend reddetti: hangisi ve neden (mesaj backend'den, Turkce)
function UploadWarning({ failures }: { failures: UploadFailure[] }) {
  return (
    <div role="alert" className="w-full rounded-md bg-destructive/10 px-3 py-2.5 text-left text-sm text-destructive">
      <p className="font-medium">Bazı dosyalar yüklenemedi:</p>
      <ul className="mt-1 list-disc pl-5">
        {failures.map((failure) => (
          <li key={failure.fileName}>
            {failure.fileName}: {failure.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ReportConfirmationProps {
  result: ReportResult;
  onNewReport: () => void;
}

// Onay ekrani: bildirim numarasi + Bildirimlerim baglantisi (docs/UI_GUIDE.md bolum 5.1, Figma: /report - onay)
export function ReportConfirmation({ result, onNewReport }: ReportConfirmationProps) {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-4 py-12 text-center md:rounded-xl md:border md:p-10">
      <CircleCheckIcon aria-hidden className="size-14 text-primary" />
      <h1 className="text-xl font-semibold">Bildiriminiz alındı, inceleniyor</h1>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Bildirim numaranız</p>
        <p className="text-2xl font-semibold">{result.created.case_number}</p>
      </div>
      <p className="text-sm text-muted-foreground">Durumunu Bildirimlerim sayfasından takip edebilirsin.</p>
      {result.failedUploads.length > 0 ? <UploadWarning failures={result.failedUploads} /> : null}
      <div className="flex w-full flex-col gap-2 pt-2">
        <Link href="/my-cases" className={buttonVariants({ className: "h-12 w-full" })}>
          Bildirimlerim
        </Link>
        <Button variant="outline" className="h-12 w-full" onClick={onNewReport}>
          Yeni bildirim yap
        </Button>
      </div>
    </div>
  );
}
