"use client";

import Link from "next/link";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { useMyCases } from "@/hooks/useCases";

import { CaseCard, CaseCardSkeleton } from "./CaseCard";

// Iskelet kart sayisi: ilk ekranda gorunen kart sayisi kadar (Figma: /my-cases - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

type MyCasesQuery = ReturnType<typeof useMyCases>;

function ReportLink() {
  return (
    <Link href="/report" className={buttonVariants({ className: "h-11 w-full px-4 md:w-auto" })}>
      Bildirim yap
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Henüz bildiriminiz yok.</p>
      <p className="text-sm text-muted-foreground">
        Kampüste gördüğün bir sorunu birkaç saniyede bildirebilirsin.
      </p>
      <div className="mt-2">
        <ReportLink />
      </div>
    </div>
  );
}

function MyCasesBody({ query }: { query: MyCasesQuery }) {
  if (query.isPending) {
    return (
      <ul aria-label="Bildirimler yükleniyor" aria-busy="true" className="grid gap-4 md:grid-cols-2">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <CaseCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Bildirimleriniz yüklenemedi."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data.items.length === 0) {
    return <EmptyState />;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {query.data.items.map((item) => (
        <li key={item.id}>
          <CaseCard item={item} />
        </li>
      ))}
    </ul>
  );
}

export function MyCasesList() {
  const query = useMyCases();
  // Bos durumda buton ortadaki metnin altinda; ustte ikinci kez gosterilmez
  const isEmpty = query.isSuccess && query.data.items.length === 0;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageTitle>Bildirimlerim</PageTitle>
        {isEmpty ? null : <ReportLink />}
      </header>
      <MyCasesBody query={query} />
    </div>
  );
}
