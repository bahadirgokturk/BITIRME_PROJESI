"use client";

import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheetIcon } from "lucide-react";

import { cn } from "cn";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { exportFileName, saveXlsx } from "@/lib/exportFile";
import type { Sheet } from "@/lib/xlsx";

interface ExportButtonProps {
  // Tarihsiz dosya adi (ornek: "kullanicilar")
  fileName: string;
  // Aktarilacak satirlar; sayfali listelerde butun sayfalar burada cekilir
  load: () => Sheet | Promise<Sheet>;
  // Liste yuklenmeden ya da bosken aktarilacak bir sey yoktur
  disabled?: boolean;
  // Dar arac satirinda telefonda yalniz simge gorunur (ad ekran okuyucuda kalir)
  compact?: boolean;
  className?: string;
}

interface TriggerProps {
  label: string;
  compact: boolean;
  disabled: boolean;
  onClick: () => void;
}

// Dar satirda telefonda yalniz simge: ad aria-label ve title ile kalir
function Trigger({ label, compact, disabled, onClick }: TriggerProps) {
  const names = compact ? { "aria-label": label, title: label } : {};
  return (
    <Button
      type="button"
      variant="outline"
      {...names}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-11 gap-2 px-3 md:h-10", compact ? "max-md:w-11 max-md:px-0" : "w-full md:w-auto")}
    >
      <FileSpreadsheetIcon aria-hidden className="size-4" />
      <span className={cn(compact && "max-md:sr-only")}>{label}</span>
    </Button>
  );
}

// "Excel'e aktar": gercek .xlsx indirir (Figma: 08 Yeni Stil (A) > liste araclari); hata dugmenin altinda yazar
export function ExportButton({ fileName, load, disabled = false, compact = false, className }: ExportButtonProps) {
  const exporting = useMutation({
    mutationFn: async () => saveXlsx(await load(), exportFileName(fileName)),
  });
  return (
    <div className={cn("space-y-2", className)}>
      <Trigger
        label={exporting.isPending ? "Hazırlanıyor…" : "Excel'e aktar"}
        compact={compact}
        disabled={disabled || exporting.isPending}
        onClick={() => exporting.mutate()}
      />
      <FormAlert error={exporting.error} />
    </div>
  );
}
