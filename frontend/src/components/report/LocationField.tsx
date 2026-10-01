"use client";

import { ChevronDownIcon, MapPinIcon } from "lucide-react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLocations, type LocationOption } from "@/hooks/useReport";
import { ApiError } from "@/lib/api/client";

interface LocationFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

const FIELD_ID = "report-location";
const ERROR_ID = "report-location-error";
const ICON_CLASS = "pointer-events-none absolute top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground";
const SELECT_CLASS = cn(
  "h-12 w-full appearance-none rounded-lg border border-input bg-background pr-10 pl-10 text-base outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);

function LocationsError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-3 text-sm">
      <div>
        <p className="font-medium text-destructive">Konumlar yüklenemedi.</p>
        {error instanceof ApiError ? <p className="text-muted-foreground">{error.message}</p> : null}
      </div>
      <Button type="button" variant="outline" className="h-11 px-4" onClick={onRetry}>
        Tekrar dene
      </Button>
    </div>
  );
}

interface LocationSelectProps extends LocationFieldProps {
  options: LocationOption[] | undefined;
}

function LocationSelect({ value, onChange, error, options }: LocationSelectProps) {
  return (
    <div className="relative">
      <MapPinIcon aria-hidden className={cn(ICON_CLASS, "left-3")} />
      <select
        id={FIELD_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={options === undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
        className={cn(SELECT_CLASS, value === "" && "text-muted-foreground")}
      >
        <option value="">{options === undefined ? "Konumlar yükleniyor…" : "Konum seçin"}</option>
        {(options ?? []).map((location) => (
          <option key={location.id} value={String(location.id)} className="text-foreground">
            {location.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon aria-hidden className={cn(ICON_CLASS, "right-3")} />
    </div>
  );
}

// Konum secici: simdilik tarayicinin kendi listesi (telefonda sistem secicisi acilir). Ad/takma adla arama
// backend'e ?q= gelince eklenecek (docs/UI_GUIDE.md bolum 5.1).
export function LocationField(props: LocationFieldProps) {
  const locations = useLocations();
  if (locations.isError) {
    return <LocationsError error={locations.error} onRetry={() => void locations.refetch()} />;
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={FIELD_ID}>Konum</Label>
      <LocationSelect {...props} options={locations.data} />
      {props.error ? (
        <p id={ERROR_ID} className="text-xs text-destructive">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}
