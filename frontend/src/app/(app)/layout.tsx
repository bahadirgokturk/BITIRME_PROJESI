import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import type { Role } from "@/lib/navigation";

// FAZ 2'de rol /auth/me yanitindan gelecek; o zamana kadar menu reporter gorunumunde
const PREVIEW_ROLE: Role = "REPORTER";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell role={PREVIEW_ROLE}>{children}</AppShell>;
}
