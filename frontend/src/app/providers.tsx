"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createQueryClient } from "@/lib/queryClient";
import { MockProvider } from "@/mocks/MockProvider";

export function Providers({ children }: { children: ReactNode }) {
  // Her tarayici oturumu icin tek QueryClient; render'lar arasinda korunur
  const [client] = useState(createQueryClient);
  return (
    <MockProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MockProvider>
  );
}
