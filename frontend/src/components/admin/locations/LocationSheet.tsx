"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateLocation, useUpdateLocation } from "@/hooks/useAdminLocations";
import {
  EMPTY_LOCATION_FORM,
  formFromLocation,
  locationFormProblems,
  parentOptions,
  toCreateBody,
  toUpdateBody,
  type AdminLocation,
  type LocationForm,
} from "@/lib/adminLocations";

import { ActiveToggle } from "../AdminParts";
import { LocationFormFields } from "./LocationFormFields";

export type LocationTarget = { mode: "create" } | { mode: "edit"; location: AdminLocation };

const ACTIVE_NOTE =
  "Pasif konum bildirim yaparken seçilemez. Kayıt silinmez; istediğiniz zaman yeniden aktifleştirebilirsiniz.";
const INACTIVE_NOTE = "Konum bildirim yaparken yeniden seçilebilir olur.";
const CREATE_NOTE = "Yeni konum, bildirim yaparken seçilebilir.";

interface LocationSheetProps {
  target: LocationTarget;
  locations: readonly AdminLocation[];
  onClose: () => void;
  onDone: (message: string) => void;
}

function StatusSection({ location, onDone }: { location: AdminLocation; onDone: (message: string) => void }) {
  const update = useUpdateLocation(location.id);
  const next = !location.is_active;
  return (
    <ActiveToggle
      active={location.is_active}
      subject="Konumu"
      note={location.is_active ? ACTIVE_NOTE : INACTIVE_NOTE}
      error={update.error}
      pending={update.isPending}
      onToggle={() =>
        update.mutate(
          { is_active: next },
          { onSuccess: () => onDone(`${location.name} ${next ? "aktifleştirildi" : "pasifleştirildi"}.`) },
        )
      }
    />
  );
}

// Ekle (POST) ya da duzenle (PATCH: yalniz degisen ust konum gonderilir); ikisi de ayni mesaj kalibini kullanir
function useSaveLocation(target: LocationTarget, onDone: (message: string) => void) {
  const create = useCreateLocation();
  const update = useUpdateLocation(target.mode === "edit" ? target.location.id : 0);
  const active = target.mode === "create" ? create : update;
  function save(form: LocationForm) {
    const done = (verb: string) => () => onDone(`${form.name.trim()} ${verb}.`);
    if (target.mode === "create") {
      create.mutate(toCreateBody(form), { onSuccess: done("eklendi") });
      return;
    }
    update.mutate(toUpdateBody(form, target.location), { onSuccess: done("güncellendi") });
  }
  return { save, error: active.error, isPending: active.isPending };
}

// Ekle/duzenle paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > /admin/locations - duzenleme paneli)
export function LocationSheet({ target, locations, onClose, onDone }: LocationSheetProps) {
  const editing = target.mode === "edit";
  const [form, setForm] = useState<LocationForm>(() => (editing ? formFromLocation(target.location) : EMPTY_LOCATION_FORM));
  const [submitted, setSubmitted] = useState(false);
  const saving = useSaveLocation(target, onDone);
  const problems = submitted ? locationFormProblems(form, target.mode) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(locationFormProblems(form, target.mode)).length === 0) {
      saving.save(form);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-5 overflow-y-auto p-6 sm:max-w-[440px]">
        <SheetTitle className="text-lg font-semibold">{editing ? "Konumu düzenle" : "Konum ekle"}</SheetTitle>
        <SheetDescription>{editing ? target.location.name : CREATE_NOTE}</SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <LocationFormFields
            form={form}
            problems={problems}
            editing={editing}
            parents={parentOptions(locations, editing ? target.location : null)}
            onChange={setForm}
          />
          <FormAlert error={saving.error} />
          {editing ? <StatusSection location={target.location} onDone={onDone} /> : null}
          <div className="mt-auto flex justify-end gap-2 pt-2">
            <SheetClose render={<Button type="button" variant="outline" className="h-11 px-4" />}>Vazgeç</SheetClose>
            <Button type="submit" className="h-11 px-4" disabled={saving.isPending}>
              {saving.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
