import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAdminAgentPolicies } from "@/hooks/useAdminAgentPolicies";
import { useAdminCaseTypes } from "@/hooks/useAdminCaseTypes";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import { useAdminLocations } from "@/hooks/useAdminLocations";
import { useAdminSlaRules } from "@/hooks/useAdminSlaRules";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { buildNameLookup, type AuditEntity, type NameLookup } from "@/lib/auditLogs";

type Schemas = components["schemas"];

// Kayitlar zamanla cogalir; diger yonetim listelerinin aksine sayfa sayfa okunur
export const AUDIT_PAGE_SIZE = 50;

export interface AuditQuery {
  entityType: AuditEntity | null;
  // Tek kaydin gecmisi icin (entityType ile birlikte)
  entityId: number | null;
  page: number;
}

function auditPath({ entityType, entityId, page }: AuditQuery): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(AUDIT_PAGE_SIZE) });
  if (entityType) {
    params.set("entity_type", entityType);
  }
  if (entityId !== null) {
    params.set("entity_id", String(entityId));
  }
  return `/admin/audit-logs?${params.toString()}`;
}

// Sayfa degisirken eski sayfa ekranda kalir (liste bosalip dolmaz)
export function useAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: ["admin", "audit-logs", query],
    queryFn: () => apiGet<Schemas["Page_AuditLogRead_"]>(auditPath(query)),
    placeholderData: keepPreviousData,
  });
}

// Kayitta yalniz numara vardir; adlar diger yonetim listelerinden gelir. Bir liste yuklenemezse o kayitlar
// numarayla ya da kaydin icindeki adla gosterilir (lib/auditLogs.ts recordName).
export function useAuditNameLookup(): NameLookup {
  const users = useAdminUsers().data;
  const departments = useAdminDepartments().data;
  const locations = useAdminLocations().data;
  const caseTypes = useAdminCaseTypes().data;
  const slaRules = useAdminSlaRules().data;
  const agentPolicies = useAdminAgentPolicies().data;
  return useMemo(
    () => buildNameLookup({ users, departments, locations, caseTypes, slaRules, agentPolicies }),
    [users, departments, locations, caseTypes, slaRules, agentPolicies],
  );
}
