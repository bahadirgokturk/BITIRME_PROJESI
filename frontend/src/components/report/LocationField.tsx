"use client";

import { MapPinIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLocations, type LocationOption } from "@/hooks/useReport";
import { ApiError } from "@/lib/api/client";
import { LOCATION_RESULT_LIMIT, searchLocations } from "@/lib/report";

interface LocationFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

const FIELD_ID = "report-location";
const ERROR_ID = "report-location-error";
const BOX_CLASS = "flex h-12 w-full items-center gap-2 rounded-lg border border-input bg-background pl-3";
const INPUT_CLASS = cn(
  "h-12 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-base outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);
const RESULT_CLASS =
  "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted";

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

// Secilen konum: ad + "Degistir". Aramaya donmek icin secim temizlenir
function ChosenLocation({ location, onClear }: { location: LocationOption; onClear: () => void }) {
  return (
    <div className={BOX_CLASS}>
      <MapPinIcon aria-hidden className="size-[18px] shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-base">{location.name}</span>
      <Button type="button" variant="ghost" className="h-11 px-3" onClick={onClear}>
        Değiştir
      </Button>
    </div>
  );
}

function LocationResults({ matches, onPick }: { matches: LocationOption[]; onPick: (id: number) => void }) {
  if (matches.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">Eşleşen konum yok. Farklı bir kelime deneyin.</p>;
  }
  const hidden = matches.length - LOCATION_RESULT_LIMIT;
  return (
    <>
      <ul aria-label="Konum sonuçları" className="divide-y overflow-hidden rounded-lg border">
        {matches.slice(0, LOCATION_RESULT_LIMIT).map((location) => (
          <li key={location.id}>
            <button type="button" className={RESULT_CLASS} onClick={() => onPick(location.id)}>
              <MapPinIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              {location.name}
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{hidden} konum daha var; aramayı daraltın.</p>
      ) : null}
    </>
  );
}

interface LocationSearchProps {
  options: LocationOption[] | undefined;
  error: string | null;
  onPick: (id: number) => void;
}

// Arama kutusu + sonuclar: ad, kod ve takma adlarda arar ("b2 wc"); bos aramada ilk konumlar listelenir
function LocationSearch({ options, error, onPick }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={FIELD_ID}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={options === undefined}
          placeholder={options === undefined ? "Konumlar yükleniyor…" : "Konum ara (ör. b2 wc)"}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          className={INPUT_CLASS}
        />
      </div>
      {options ? <LocationResults matches={searchLocations(options, query)} onPick={onPick} /> : null}
    </div>
  );
}

// Konum secici (docs/UI_GUIDE.md bolum 5.1). Konumlar bir kez yuklenir, arama tarayicida yapilir:
// her tusta sunucuya gitmez, telefonda aninda sonuc verir.
export function LocationField({ value, onChange, error }: LocationFieldProps) {
  const locations = useLocations();
  if (locations.isError) {
    return <LocationsError error={locations.error} onRetry={() => void locations.refetch()} />;
  }
  const chosen = locations.data?.find((location) => String(location.id) === value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={FIELD_ID}>Konum</Label>
      {chosen ? (
        <ChosenLocation location={chosen} onClear={() => onChange("")} />
      ) : (
        <LocationSearch options={locations.data} error={error} onPick={(id) => onChange(String(id))} />
      )}
      {error ? (
        <p id={ERROR_ID} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
