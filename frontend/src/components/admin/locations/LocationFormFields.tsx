import { Input } from "@/components/ui/input";
import {
  KIND_LABELS,
  type LocationForm,
  type LocationFormProblems,
  type LocationKind,
  type ParentOption,
} from "@/lib/adminLocations";

import { Choice, Field } from "../Field";

const CODE_HINT = "Kısa ve benzersiz bir kod. Örnek: B-201. Sonradan değiştirilemez.";
const IMPORTANCE_HINT =
  "0 ile 100 arası. Yapay zekâ önceliği belirlerken kullanır; amfi, laboratuvar gibi yerlerde yükseltin.";
const ALIASES_HINT = "İnsanların bu yer için kullandığı başka adlar. Virgülle ayırın: b2 wc, erkek tuvalet";
const TOP_LEVEL = "Yok (en üst düzey)";

interface LocationFormFieldsProps {
  form: LocationForm;
  problems: LocationFormProblems;
  editing: boolean;
  parents: readonly ParentOption[];
  onChange: (form: LocationForm) => void;
}

type FieldsProps = Omit<LocationFormFieldsProps, "parents">;

// Ad, tur ve kod: tur ile kod yalniz eklerken secilir (LocationUpdate'te yoklar)
function IdentityFields({ form, problems, editing, onChange }: FieldsProps) {
  return (
    <>
      <Field label="Konum adı" error={problems.name}>
        {(c) => <Input {...c} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} className="h-11" />}
      </Field>
      <Field label="Tür" hint={editing ? "Tür sonradan değiştirilemez." : undefined}>
        {(c) => (
          <Choice
            control={c}
            value={form.kind}
            options={Object.entries(KIND_LABELS)}
            disabled={editing}
            onChange={(v) => onChange({ ...form, kind: v as LocationKind })}
          />
        )}
      </Field>
      <Field label="Kod" error={problems.code} hint={editing ? "Kod sonradan değiştirilemez." : CODE_HINT}>
        {(c) => (
          <Input
            {...c}
            value={form.code}
            readOnly={editing}
            onChange={(e) => onChange({ ...form, code: e.target.value })}
            className={editing ? "h-11 bg-muted" : "h-11"}
          />
        )}
      </Field>
    </>
  );
}

// Konum formu: ust konum degisirse konum altindakilerle birlikte tasinir
export function LocationFormFields({ form, problems, editing, parents, onChange }: LocationFormFieldsProps) {
  const parentOptions = parents.map((parent): [string, string] => [String(parent.id), parent.label]);
  return (
    <>
      <IdentityFields form={form} problems={problems} editing={editing} onChange={onChange} />
      <Field label="Üst konum" hint={editing ? "Değiştirirseniz konum, altındakilerle birlikte taşınır." : undefined}>
        {(c) => (
          <Choice
            control={c}
            value={form.parent_id}
            options={parentOptions}
            placeholder={TOP_LEVEL}
            onChange={(v) => onChange({ ...form, parent_id: v })}
          />
        )}
      </Field>
      <Field label="Önem" error={problems.importance} hint={IMPORTANCE_HINT}>
        {(c) => (
          <Input
            {...c}
            inputMode="numeric"
            value={form.importance}
            onChange={(e) => onChange({ ...form, importance: e.target.value })}
            className="h-11"
          />
        )}
      </Field>
      <Field label="Diğer adlar" hint={ALIASES_HINT}>
        {(c) => <Input {...c} value={form.aliases} onChange={(e) => onChange({ ...form, aliases: e.target.value })} className="h-11" />}
      </Field>
    </>
  );
}
