"use client";

import { useState } from "react";

import { ErrorState } from "@/components/states/ErrorState";
import { useAdminAgentPolicies } from "@/hooks/useAdminAgentPolicies";
import { useAdminCaseTypes } from "@/hooks/useAdminCaseTypes";
import {
  agentPolicyRows,
  AUTONOMY_LABELS,
  filterAgentPolicies,
  NO_AGENT_POLICY_FILTERS,
  type AgentPolicyFilters as Filters,
  type AgentPolicyRow,
  type AutonomyLevel,
} from "@/lib/adminAgentPolicies";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { FilterSelect, SearchInput } from "../SearchFilters";
import { AgentPoliciesTable } from "./AgentPoliciesTable";
import { AgentPolicySheet } from "./AgentPolicySheet";

type PoliciesQuery = ReturnType<typeof useAdminAgentPolicies>;
type CaseTypes = ReturnType<typeof useAdminCaseTypes>["data"];

const ALL = "";
const DESCRIPTION =
  "Yapay zekânın her bildirim türünde ne kadar kendi başına karar vereceği. Politika, tür eklenince kendiliğinden açılır; buradan yalnız düzenlenir.";

interface BodyProps {
  query: PoliciesQuery;
  filters: Filters;
  caseTypes: CaseTypes;
  onEdit: (row: AgentPolicyRow) => void;
  onClear: () => void;
}

function PoliciesBody({ query, filters, caseTypes, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Yapay zekâ politikaları yükleniyor" />;
  }
  if (query.isError) {
    return (
      <ErrorState title="Yapay zekâ politikaları yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const shown = filterAgentPolicies(agentPolicyRows(query.data, caseTypes), filters);
  return (
    <>
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan politika yok." onClear={onClear} />
      ) : (
        <AgentPoliciesTable rows={shown} onEdit={onEdit} footer={`${query.data.length} politika`} />
      )}
    </>
  );
}

// Arama + karar yetkisi; politika pasiflestirilemedigi icin durum suzgeci yok (Figma: Filters)
function PolicyFilters({ value, onChange }: { value: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <SearchInput
        aria-label="Politika ara"
        placeholder="Tür adı ya da kod ara"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className="w-full md:w-80"
      />
      <FilterSelect
        aria-label="Karar yetkisi"
        value={value.autonomy ?? ALL}
        onChange={(event) => onChange({ ...value, autonomy: (event.target.value || null) as AutonomyLevel | null })}
        className="w-full md:w-64"
      >
        <option value={ALL}>Tüm karar yetkileri</option>
        {Object.entries(AUTONOMY_LABELS).map(([level, label]) => (
          <option key={level} value={level}>
            {label}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}

// Yonetim > Yapay Zeka Politikalari (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + duzenleme paneli
export function AgentPoliciesScreen() {
  const policies = useAdminAgentPolicies();
  const caseTypes = useAdminCaseTypes();
  const [filters, setFilters] = useState<Filters>(NO_AGENT_POLICY_FILTERS);
  const [editing, setEditing] = useState<AgentPolicyRow | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setEditing(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/agent-policies" />
      <ScreenHeader title="Yapay Zekâ Politikaları" description={DESCRIPTION} />
      <ActionNote message={lastAction} />
      <PolicyFilters value={filters} onChange={setFilters} />
      <PoliciesBody
        query={policies}
        filters={filters}
        caseTypes={caseTypes.data}
        onEdit={setEditing}
        onClear={() => setFilters(NO_AGENT_POLICY_FILTERS)}
      />
      {editing ? (
        <AgentPolicySheet key={editing.policy.id} row={editing} onClose={() => setEditing(null)} onDone={done} />
      ) : null}
    </div>
  );
}
