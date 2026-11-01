"use client";

import { useState } from "react";

import { ExportButton } from "@/components/export/ExportButton";
import { locationsSheet } from "@/lib/exportSheets";
import { ErrorState } from "@/components/states/ErrorState";
import { useAdminLocations } from "@/hooks/useAdminLocations";
import {
  filterLocations,
  isFiltered,
  locationRows,
  locationTrail,
  NO_LOCATION_FILTERS,
  rootIds,
  type AdminLocation,
  type LocationFilters as Filters,
} from "@/lib/adminLocations";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader, Toolbar } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { SearchFilters } from "../SearchFilters";
import { LocationList, type ListRow } from "./LocationList";
import { LocationSheet, type LocationTarget } from "./LocationSheet";

type LocationsQuery = ReturnType<typeof useAdminLocations>;

// Arama ya da suzgec varken sonuclar duz listedir ve her sonucun yeri yazilir; yoksa agac gosterilir
function visibleRows(locations: readonly AdminLocation[], filters: Filters, expanded: ReadonlySet<number>): ListRow[] {
  if (!isFiltered(filters)) {
    return locationRows(locations, expanded);
  }
  return filterLocations(locations, filters).map((location) => ({
    location,
    depth: 0,
    hasChildren: false,
    expanded: false,
    trail: locationTrail(location, locations),
  }));
}

interface BodyProps {
  query: LocationsQuery;
  filters: Filters;
  onEdit: (target: LocationTarget) => void;
  onClear: () => void;
}

function LocationsBody({ query, filters, onEdit, onClear }: BodyProps) {
  // Kullanici bir dal acip kapatana kadar en ust duzey acik gelir
  const [toggled, setToggled] = useState<Set<number> | null>(null);
  if (query.isPending) {
    return <ListSkeleton label="Konumlar yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Konumlar yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const expanded = toggled ?? rootIds(query.data);
  const rows = visibleRows(query.data, filters, expanded);
  const active = query.data.filter((location) => location.is_active).length;

  function toggle(id: number) {
    const next = new Set(expanded);
    if (!next.delete(id)) {
      next.add(id);
    }
    setToggled(next);
  }

  return (
    <>
      {rows.length === 0 ? (
        <NoMatch title="Aramanıza uyan konum yok." onClear={onClear} />
      ) : (
        <LocationList
          rows={rows}
          onToggle={toggle}
          onEdit={(location) => onEdit({ mode: "edit", location })}
          footer={`${query.data.length} konum, ${active} aktif`}
        />
      )}
    </>
  );
}

// Aramasiz aktarimda agacin tamami, aramada uyan konumlar (lib/exportSheets.ts)
function LocationsExport({ query, filters }: Pick<BodyProps, "query" | "filters">) {
  return (
    <ExportButton
      fileName="konumlar"
      disabled={!query.data}
      load={() => locationsSheet(query.data ?? [], filters)}
    />
  );
}

// Yonetim > Konumlar (docs/UI_GUIDE.md bolum 5.5): agac gorunumu + arama + sagdan acilan panel
export function LocationsScreen() {
  const locations = useAdminLocations();
  const [filters, setFilters] = useState<Filters>(NO_LOCATION_FILTERS);
  const [target, setTarget] = useState<LocationTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/locations" />
      <ScreenHeader
        title="Konumlar"
        description="Bildirim yaparken seçilen yerler: kampüs, bina, kat ve alanlar. Bir konumun altını görmek için okuna basın."
        addLabel="Konum ekle"
        onAdd={() => setTarget({ mode: "create" })}
      />
      <ActionNote message={lastAction} />
      <Toolbar action={<LocationsExport query={locations} filters={filters} />}>
        <SearchFilters
          searchLabel="Konum ara"
          placeholder="Ad, kod ya da diğer ad ara"
          value={filters}
          onChange={setFilters}
        />
      </Toolbar>
      <LocationsBody query={locations} filters={filters} onEdit={setTarget} onClear={() => setFilters(NO_LOCATION_FILTERS)} />
      {target ? (
        <LocationSheet
          key={target.mode === "edit" ? target.location.id : "new"}
          target={target}
          locations={locations.data ?? []}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
