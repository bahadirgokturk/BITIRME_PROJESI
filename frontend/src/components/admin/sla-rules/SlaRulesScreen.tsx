"use client";

import { useState } from "react";

import { ExportButton } from "@/components/export/ExportButton";
import { slaRulesSheet } from "@/lib/exportSheets";
import { ErrorState } from "@/components/states/ErrorState";
import { useAdminCaseTypes } from "@/hooks/useAdminCaseTypes";
import { useAdminSlaRules } from "@/hooks/useAdminSlaRules";
import {
  filterSlaRules,
  NO_SLA_RULE_FILTERS,
  slaRuleRows,
  type Priority,
  type SlaRuleFilters as Filters,
} from "@/lib/adminSlaRules";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader, Toolbar } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { FilterSelect, SearchFilters } from "../SearchFilters";
import { SlaRuleSheet, type SlaRuleTarget } from "./SlaRuleSheet";
import { SlaRulesTable } from "./SlaRulesTable";

type RulesQuery = ReturnType<typeof useAdminSlaRules>;
type CaseTypes = ReturnType<typeof useAdminCaseTypes>["data"];

const ALL = "";
const DESCRIPTION =
  "Bir bildirimin ne kadar sürede kabul edilip çözülmesi gerektiği. Türe özel kural yoksa o önceliğin varsayılan kuralı geçerlidir.";

interface BodyProps {
  query: RulesQuery;
  filters: Filters;
  caseTypes: CaseTypes;
  onEdit: (target: SlaRuleTarget) => void;
  onClear: () => void;
}

function SlaRulesBody({ query, filters, caseTypes, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Süre hedefleri yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Süre hedefleri yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const shown = filterSlaRules(slaRuleRows(query.data, caseTypes), filters);
  const active = query.data.filter((rule) => rule.is_active).length;
  return (
    <>
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan kural yok." onClear={onClear} />
      ) : (
        <SlaRulesTable
          rows={shown}
          onEdit={(row) => onEdit({ mode: "edit", row })}
          footer={`${query.data.length} kural, ${active} aktif`}
        />
      )}
    </>
  );
}

function PriorityFilter({ value, onChange }: { value: Priority | null; onChange: (priority: Priority | null) => void }) {
  return (
    <FilterSelect
      aria-label="Öncelik"
      value={value ?? ALL}
      onChange={(event) => onChange((event.target.value || null) as Priority | null)}
      className="w-full md:w-52"
    >
      <option value={ALL}>Tüm öncelikler</option>
      {Object.entries(PRIORITY_LABELS).map(([priority, label]) => (
        <option key={priority} value={priority}>
          {label}
        </option>
      ))}
    </FilterSelect>
  );
}

// Eklerken yalniz aktif turler secilir; duzenlerken kuralin (pasif olabilen) turu de listede kalir
function selectableTypes(caseTypes: CaseTypes, target: SlaRuleTarget) {
  const linked = target.mode === "edit" ? target.row.rule.case_type_id : null;
  return (caseTypes ?? []).filter((type) => type.is_active || type.id === linked);
}

function SlaRulesExport({ query, filters, caseTypes }: Omit<BodyProps, "onEdit" | "onClear">) {
  return (
    <ExportButton
      fileName="sure-hedefleri"
      disabled={!query.data}
      load={() => slaRulesSheet(filterSlaRules(slaRuleRows(query.data ?? [], caseTypes), filters))}
    />
  );
}

// Yonetim > Sure Hedefleri (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + sagdan acilan panel
export function SlaRulesScreen() {
  const rules = useAdminSlaRules();
  const caseTypes = useAdminCaseTypes();
  const [filters, setFilters] = useState<Filters>(NO_SLA_RULE_FILTERS);
  const [target, setTarget] = useState<SlaRuleTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/sla-rules" />
      <ScreenHeader title="Süre Hedefleri" description={DESCRIPTION} addLabel="Kural ekle" onAdd={() => setTarget({ mode: "create" })} />
      <ActionNote message={lastAction} />
      <Toolbar action={<SlaRulesExport query={rules} filters={filters} caseTypes={caseTypes.data} />}>
        <SearchFilters searchLabel="Kural ara" placeholder="Tür adı ara" value={filters} onChange={setFilters}>
          <PriorityFilter value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} />
        </SearchFilters>
      </Toolbar>
      <SlaRulesBody
        query={rules}
        filters={filters}
        caseTypes={caseTypes.data}
        onEdit={setTarget}
        onClear={() => setFilters(NO_SLA_RULE_FILTERS)}
      />
      {target ? (
        <SlaRuleSheet
          key={target.mode === "edit" ? target.row.rule.id : "new"}
          target={target}
          rules={rules.data ?? []}
          caseTypes={selectableTypes(caseTypes.data, target)}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
