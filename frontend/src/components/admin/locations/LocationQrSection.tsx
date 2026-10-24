"use client";

import { DownloadIcon } from "lucide-react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDownloadLocationQr, useLocationQrPreview } from "@/hooks/useAdminLocations";
import type { AdminLocation, QrFormat } from "@/lib/adminLocations";

const FORMATS: { format: QrFormat; label: string }[] = [
  { format: "svg", label: "SVG indir" },
  { format: "png", label: "PNG indir" },
];
const NOTE = "Kapıya asın. Okutan kişi bildirim formunu bu konum seçili açar.";
const INACTIVE_NOTE = "Pasif konumun QR kodu okutulunca form konumu bulamaz. Önce aktifleştirin.";
const PREVIEW_CLASS = "size-32 rounded-lg border bg-white p-2";

function QrPreview({ location }: { location: AdminLocation }) {
  const preview = useLocationQrPreview(location.id, true);
  if (preview.isPending) {
    return <Skeleton aria-label="QR kodu yükleniyor" className="size-32" />;
  }
  if (preview.isError) {
    return <FormAlert error={preview.error} />;
  }
  // Yetkiyle alinan gecici blob adresi: next/image optimizasyonu bu adresi isleyemez
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={preview.data} alt={`${location.name} QR kodu`} className={PREVIEW_CLASS} />;
}

// Kapiya asilacak QR (GET /admin/locations/{id}/qr): onizleme + SVG/PNG indirme. Pasif konumda kod islemez,
// bu yuzden indirme yerine aciklama gosterilir (Figma: 06 Admin > /admin/locations - duzenleme paneli > QrSection)
export function LocationQrSection({ location }: { location: AdminLocation }) {
  const download = useDownloadLocationQr(location);
  return (
    <section aria-label="QR kodu" className="space-y-2 rounded-lg border p-4">
      <h3 className="text-sm font-medium">QR kodu</h3>
      <p className="text-[13px] text-muted-foreground">{location.is_active ? NOTE : INACTIVE_NOTE}</p>
      {location.is_active ? (
        <>
          <QrPreview location={location} />
          <FormAlert error={download.error} />
          <div className="flex flex-wrap gap-2">
            {FORMATS.map(({ format, label }) => (
              <Button
                key={format}
                type="button"
                variant="outline"
                className="h-11 px-4"
                disabled={download.isPending}
                onClick={() => download.mutate(format)}
              >
                <DownloadIcon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
