import type { ReactNode } from "react";

import { CurrentUserShell } from "@/components/layout/CurrentUserShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <CurrentUserShell>{children}</CurrentUserShell>;
}
