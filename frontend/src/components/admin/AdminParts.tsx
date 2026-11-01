import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "cn";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { historyHref, type AuditEntity } from "@/lib/auditLogs";
import { initialsOf } from "@/lib/shell";

// Yonetim ekranlarinin ortak parcalari (docs/UI_GUIDE.md bolum 5.5: arama + suzgec + tablo + panel kalibi)

// Ekle/duzenle paneli: telefonda tam genislik, masaustunde 440 px. Genislik data-[side=right] ile yazilir;
// yoksa shadcn Sheet'in kendi kurali (ekranin 3/4'u) one gecer ve telefonda form dar kalir.
export const SHEET_CLASS =
  "gap-5 overflow-y-auto p-6 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]";

interface ScreenHeaderProps {
  title: string;
  // Basligin kendini acikladigi ekranlarda (ornek: islem kayitlari) verilmez
  description?: string;
  // Ekleme olmayan ekranlarda (ornek: yapay zeka politikalari) verilmez
  addLabel?: string;
  onAdd?: () => void;
}

// Yeni stil sayfa basi: baslik + aciklama solda, ekle dugmesi sagda (Figma: 08 Yeni Stil (A) > Yonetim)
export function ScreenHeader({ title, description, addLabel, onAdd }: ScreenHeaderProps) {
  const action = addLabel ? (
    <Button className="h-11 gap-1.5 px-4 md:h-10" onClick={onAdd}>
      <PlusIcon aria-hidden className="size-4" />
      {addLabel}
    </Button>
  ) : null;
  return <PageHeader title={title} description={description} actions={action} />;
}

export type TagTone = "plain" | "muted" | "success" | "info" | "warning";

// Koseli cerceveli etiket: rol, kod, karar yetkisi (oncelik rozetiyle ayni bicim)
const TAG_TONES: Record<TagTone, string> = {
  plain: "",
  muted: "text-muted-foreground",
  success: "border-success/30 bg-success/5 text-success",
  info: "border-primary/30 bg-primary/5 text-primary-text",
  warning: "border-warning/30 bg-warning/5 text-warning",
};

export function Tag({ tone = "plain", children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-md border px-2 text-xs font-medium break-all",
        TAG_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

// Ad soyadin bas harfleri; adin yaninda susleme, ekran okuyucu adi zaten okur
export function Initials({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground"
    >
      {initialsOf(name)}
    </span>
  );
}

const SEARCH_HINT = "Farklı bir kelime deneyin ya da filtreleri temizleyin.";

interface NoMatchProps {
  title: string;
  // Arama kutusu olmayan ekran kendi onerisini verir
  hint?: string;
  onClear: () => void;
}

// Suzgeclere uyan kayit yoksa: aciklama + suzgecleri temizleme
export function NoMatch({ title, hint = SEARCH_HINT, onClear }: NoMatchProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Button variant="outline" className="mt-2 h-11 px-4" onClick={onClear}>
        Filtreleri temizle
      </Button>
    </div>
  );
}

// Iskelet satir sayisi: tasarimdaki ornek tablo kadar (Figma: 06 Admin > yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="grid gap-3 md:surface md:p-4">
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

// Durum rozetiyle ayni bicim: yuvarlak hat, noktali (Figma: 08 Yeni Stil (A) > yonetim tablolari)
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      data-tone={active ? "active" : "inactive"}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        !active && "text-muted-foreground",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
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

// Duzenleme panelinden kaydin gecmisine gecis (Islem Kayitlari, tek kayit suzgeci); dugme satirinin solunda durur
export function HistoryLink({ entity, id }: { entity: AuditEntity; id: number }) {
  return (
    <Link
      href={historyHref(entity, id)}
      className="mr-auto inline-flex min-h-11 items-center text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Geçmişi gör
    </Link>
  );
}
