import Link from "next/link";

import { cn } from "cn";

import { ADMIN_SECTIONS } from "@/lib/navigation";

// Telefonda sekmeler ekrana sigmaz: serit yana kayar, secili sekme acilista gorunur yere getirilir
function showCurrent(link: HTMLAnchorElement | null) {
  link?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

// Yonetim bolum sekmeleri; secili sekme turkuaz cizgi + aria-current (Figma: 08 Yeni Stil (A) > Yonetim)
export function AdminSections({ active }: { active: string }) {
  return (
    <nav aria-label="Yönetim bölümleri" className="border-b">
      <ul className="flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        {ADMIN_SECTIONS.map((section) => {
          const current = section.href === active;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                ref={current ? showCurrent : undefined}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-2 text-sm outline-none",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 md:px-3 md:text-[15px]",
                  current ? "border-primary font-medium" : "text-muted-foreground hover:text-foreground",
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
