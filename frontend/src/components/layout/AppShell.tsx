import Link from "next/link";
import type { ReactNode } from "react";

import { navigationFor, type Role } from "@/lib/navigation";

interface AppShellProps {
  role: Role;
  children: ReactNode;
}

export function AppShell({ role, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b bg-muted/40 p-4 md:w-56 md:border-r md:border-b-0">
        <p className="mb-4 font-semibold">CampusFlow AI</p>
        <nav aria-label="Ana menü">
          <ul className="flex flex-wrap gap-2 md:flex-col">
            {navigationFor(role).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
