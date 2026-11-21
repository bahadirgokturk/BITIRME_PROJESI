"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "cn";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIdleStart } from "@/hooks/useIdleStart";
import { useMarkAllRead, useMarkRead, useNotificationList, useUnreadCount } from "@/hooks/useNotifications";
import { relativeTime } from "@/lib/dates";
import { bellLabel, notificationHref, unreadBadge, type NotificationRead } from "@/lib/notifications";

// Okunmamis varsa acik turuncu, yoksa acik gri (Figma: WaitingBell). Pencere acikken de ayni renk kalir
const TONE = {
  unread:
    "bg-warning/15 text-warning hover:bg-warning/25 hover:text-warning " +
    "aria-expanded:bg-warning/25 aria-expanded:text-warning",
  idle: "bg-muted hover:bg-muted/80",
} as const;
// Sayi zemin renginde: acik temada turuncu ustunde beyaz, koyu temada sari ustunde koyu (okunur kontrast)
const BADGE_CLASS =
  "absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] " +
  "font-semibold text-background tabular-nums";
const ITEM_CLASS =
  "flex min-h-11 gap-2.5 rounded-md px-2 py-2 outline-none hover:bg-muted " +
  "focus-visible:ring-3 focus-visible:ring-ring/50";
const TRIGGER_CLASS = "relative size-11 shrink-0 md:size-10";
const DOT_CLASS = "mt-1.5 size-2 shrink-0 rounded-full";

interface ItemProps {
  item: NotificationRead;
  href: string;
  onOpen: (item: NotificationRead) => void;
}

// Okunmamis bildirim kalin ve noktali; nokta yaninda metin de soyler (renk tek basina anlam tasimaz)
function NotificationItem({ item, href, onOpen }: ItemProps) {
  const unread = item.read_at === null;
  return (
    <li>
      <Link href={href} onClick={() => onOpen(item)} className={ITEM_CLASS}>
        <span aria-hidden className={cn(DOT_CLASS, unread ? "bg-warning" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", unread && "font-semibold")}>{item.message}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.case_title} · {relativeTime(item.created_at)}
            {unread ? <span className="sr-only"> · okunmadı</span> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ListState({ query }: { query: ReturnType<typeof useNotificationList> }) {
  if (query.isPending) {
    return (
      <div aria-label="Bildirimler yükleniyor" aria-busy="true" className="space-y-2 px-2 py-1">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  return (
    <div className="space-y-2 px-2 pb-1.5">
      <p className="text-[13px] text-muted-foreground">
        {query.isError ? "Bildirimler yüklenemedi." : "Henüz bildirim yok."}
      </p>
      {query.isError ? (
        <Button variant="outline" className="h-9 px-3" onClick={() => void query.refetch()}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}

// Pencere acilinca liste okunur; tiklanan bildirim okundu sayilir ve kaydin rolun kendi ekraninda acilir
function NotificationList({ onPick }: { onPick: () => void }) {
  const query = useNotificationList(true);
  const role = useCurrentUser().data?.role;
  const markRead = useMarkRead();
  if (!query.data?.length || !role) {
    return <ListState query={query} />;
  }
  function open(item: NotificationRead) {
    if (item.read_at === null) {
      markRead.mutate(item.id);
    }
    onPick();
  }
  return (
    <ul aria-label="Son bildirimler" className="max-h-90 overflow-y-auto">
      {query.data.map((item) => (
        <NotificationItem key={item.id} item={item} href={notificationHref(role, item.case_id)} onOpen={open} />
      ))}
    </ul>
  );
}

function ReadAllButton() {
  const readAll = useMarkAllRead();
  return (
    <Button variant="ghost" className="h-8 px-2 text-xs" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
      Tümünü okundu say
    </Button>
  );
}

// Kisisel bildirimler (GET /notifications): her rolde ust cubukta. Rozet okunmamis sayisini gosterir
// (sayfa acilisi bittikten sonra sorulur, iki dakikada bir yenilenir)
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const count = useUnreadCount(useIdleStart()).data ?? 0;
  const badge = unreadBadge(count);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={bellLabel(count)}
        className={cn(buttonVariants({ variant: "ghost" }), TRIGGER_CLASS, TONE[badge ? "unread" : "idle"], className)}
      >
        <BellIcon aria-hidden className="size-5" />
        {badge ? <span aria-hidden className={BADGE_CLASS}>{badge}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-24px)] gap-1 p-2">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <PopoverTitle className="text-sm font-semibold">Bildirimler</PopoverTitle>
          {count > 0 ? <ReadAllButton /> : null}
        </div>
        {open ? <NotificationList onPick={() => setOpen(false)} /> : null}
      </PopoverContent>
    </Popover>
  );
}
