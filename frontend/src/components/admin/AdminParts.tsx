import { cn } from "cn";

import { PageTitle } from "@/components/layout/PageTitle";
import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Yonetim ekranlarinin ortak parcalari (docs/UI_GUIDE.md bolum 5.5: arama + suzgec + tablo + panel kalibi)

interface ScreenHeaderProps {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
}

export function ScreenHeader({ title, description, addLabel, onAdd }: ScreenHeaderProps) {
  return (
    <header className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <PageTitle>{title}</PageTitle>
        <Button className="h-11 px-4" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

// Suzgeclere uyan kayit yoksa: aciklama + suzgecleri temizleme
export function NoMatch({ title, onClear }: { title: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">Farklı bir kelime deneyin ya da süzgeçleri temizleyin.</p>
      <Button variant="outline" className="mt-2 h-11 px-4" onClick={onClear}>
        Süzgeçleri temizle
      </Button>
    </div>
  );
}

// Iskelet satir sayisi: tasarimdaki ornek tablo kadar (Figma: 06 Admin > yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="grid gap-3 md:rounded-xl md:border md:p-4">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-28 w-full md:h-5" />
      ))}
    </div>
  );
}

// Son islemin sonucu; ekran okuyucuya da duyurulur
export function ActionNote({ message }: { message: string | null }) {
  return (
    <p role="status" className={message ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
      {message}
    </p>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

interface ActiveToggleProps {
  active: boolean;
  // Basliktaki nesne, belirtme haliyle (ornek: "Birimi")
  subject: string;
  note: string;
  error: Error | null;
  pending: boolean;
  onToggle: () => void;
}

// Pasiflestirme silme degildir: kayit kalir, sonradan yeniden aktiflestirilebilir (UI_GUIDE bolum 5.5)
export function ActiveToggle({ active, subject, note, error, pending, onToggle }: ActiveToggleProps) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium">
        {subject} {active ? "pasifleştir" : "aktifleştir"}
      </p>
      <p className="text-[13px] text-muted-foreground">{note}</p>
      <FormAlert error={error} />
      <Button
        type="button"
        variant="outline"
        className={active ? "h-11 px-4 text-destructive" : "h-11 px-4"}
        disabled={pending}
        onClick={onToggle}
      >
        {active ? "Pasifleştir" : "Aktifleştir"}
      </Button>
    </div>
  );
}
