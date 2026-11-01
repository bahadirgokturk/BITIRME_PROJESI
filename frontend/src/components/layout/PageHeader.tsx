import type { ReactNode } from "react";

import { PageTitle } from "./PageTitle";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  // Sag ustteki islemler (donem, Yazdir, gorunum); telefonda basligin altina iner
  actions?: ReactNode;
  // Basligin altinda ek satir (ornek: yazdirmada donem bilgisi)
  meta?: ReactNode;
}

// Yeni stil sayfa basi (Figma: 08 Yeni Stil (A)): baslik, hemen altinda aciklama, sagda islemler
export function PageHeader({ title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <PageTitle>{title}</PageTitle>
        {description ? <p className="text-sm text-muted-foreground md:text-[15px]">{description}</p> : null}
        {meta}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
