import Link from "next/link";

import { cn } from "cn";

import { ADMIN_SECTIONS } from "@/lib/navigation";

// Telefonda sekmeler ekrana sigmaz: serit yana kayar, secili sekme acilista gorunur yere getirilir
function showCurrent(link: HTMLAnchorElement | null) {
  link?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

// Yonetim bolum sekmeleri; secili sekme turuncu cizgi + aria-current (Figma: 06 Admin > AdminTabs)
export function AdminSections({ active }: { active: string }) {
  return (
    <nav aria-label="Yönetim bölümleri" className="border-b">
      <ul className="flex gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        {ADMIN_SECTIONS.map((section) => {
          const current = section.href === active;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                ref={current ? showCurrent : undefined}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  current ? "border-brand-accent font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
