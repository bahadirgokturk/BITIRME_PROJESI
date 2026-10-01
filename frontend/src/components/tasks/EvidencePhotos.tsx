"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAttachmentImage, useCaseEvidence, type AttachmentRead } from "@/hooks/useAttachments";

const THUMB_CLASS = "size-20 rounded-md";

function EvidencePhoto({ attachment, label }: { attachment: AttachmentRead; label: string }) {
  const image = useAttachmentImage(attachment.id);
  if (image.isPending) {
    return <Skeleton className={THUMB_CLASS} />;
  }
  if (image.isError) {
    return (
      <p className={`${THUMB_CLASS} flex items-center border p-1 text-center text-xs text-muted-foreground`}>
        Fotoğraf yüklenemedi
      </p>
    );
  }
  return (
    <a href={image.data} target="_blank" rel="noreferrer" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {/* Yetkili indirilen blob adresi: next/image kullanilamaz */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.data} alt={label} className={`${THUMB_CLASS} border object-cover`} />
    </a>
  );
}

// Tamamlanan gorevde personelin yukledigi kanit fotograflari; hic yoksa bolum gosterilmez
export function EvidencePhotos({ caseId }: { caseId: number }) {
  const evidence = useCaseEvidence(caseId);
  if (evidence.isError) {
    return <p className="text-sm text-muted-foreground">Kanıt fotoğrafları yüklenemedi.</p>;
  }
  if (!evidence.data || evidence.data.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="text-xs text-muted-foreground">Kanıt fotoğrafları</h3>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {evidence.data.map((attachment, index) => (
          <li key={attachment.id}>
            <EvidencePhoto attachment={attachment} label={`Kanıt fotoğrafı ${index + 1}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
