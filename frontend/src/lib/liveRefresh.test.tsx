import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useKpis } from "@/hooks/useAnalytics";
import { useCase, useCaseEvents, useCaseList, useMyCases } from "@/hooks/useCases";
import { useCaseComments } from "@/hooks/useComments";
import { useReviewQueue } from "@/hooks/useReview";
import { useMyTasks, useTask } from "@/hooks/useTasks";
import { DEFAULT_FILTERS } from "@/lib/caseList";

import { createQueryClient, LIVE_REFRESH_MS } from "./queryClient";

function intervalOf(client: QueryClient, run: () => unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(run, { wrapper });
  const [query] = client.getQueryCache().getAll();
  return query?.observers[0]?.options.refetchInterval;
}

// Is listeleri ve detaylar baskasi degistirdiginde de guncel kalmali (personel, mudur, bildiren)
const LIVE_HOOKS: [string, () => unknown][] = [
  ["my tasks", () => useMyTasks()],
  ["one task", () => useTask("1")],
  ["review queue", () => useReviewQueue()],
  ["my cases", () => useMyCases()],
  ["all cases", () => useCaseList(DEFAULT_FILTERS)],
  ["one case", () => useCase("1")],
  ["case timeline", () => useCaseEvents("1")],
  ["case comments", () => useCaseComments(1)],
  ["dashboard KPIs", () => useKpis("7d")],
];

describe("live refresh", () => {
  it.each(LIVE_HOOKS)("re-reads %s on a timer", async (_name, run) => {
    const client = createQueryClient();
    expect(LIVE_REFRESH_MS).toBeGreaterThan(0);

    await waitFor(() => expect(intervalOf(client, run)).toBe(LIVE_REFRESH_MS));
  });
});
