"use client";

import { EvidencePhoto } from "@/components/tasks/EvidencePhotos";
import { useCaseAttachments } from "@/hooks/useAttachments";
import { photoList } from "@/lib/managerCase";

import { CARD_CLASS } from "./CaseSummary";

// Bildirenin fotograflari ve personelin kanitlari; hic fotograf yoksa bolum gosterilmez
export function CasePhotos({ caseId }: { caseId: number }) {
  const attachments = useCaseAttachments(caseId);
  if (attachments.isError) {
    return <p className="text-sm text-muted-foreground">Fotoğraflar yüklenemedi.</p>;
  }
  const photos = photoList(attachments.data ?? []);
  if (photos.length === 0) {
    return null;
  }
  return (
    <section className={`${CARD_CLASS} space-y-3`}>
      <h2 className="text-base font-semibold">Fotoğraflar</h2>
      <ul className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          <li key={photo.attachment.id} className="space-y-1">
            <EvidencePhoto attachment={photo.attachment} label={photo.label} />
            <p className="text-xs text-muted-foreground">{photo.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
