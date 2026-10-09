import { Input } from "@/components/ui/input";
import { needsDepartment, type FormMode, type UserForm, type UserFormProblems } from "@/lib/admin";
import { REPORTER_KIND_LABELS, ROLE_LABELS } from "@/lib/shell";

import { Choice, Field } from "./Field";

interface UserFormFieldsProps {
  form: UserForm;
  problems: UserFormProblems;
  mode: FormMode;
  departments: readonly { id: number; name: string }[];
  onChange: (form: UserForm) => void;
}

// Role gore alanlar: bildirim yapan -> kullanici turu, personel/mudur -> birim; parola yalniz eklerken
export function UserFormFields({ form, problems, mode, departments, onChange }: UserFormFieldsProps) {
  const set = (fields: Partial<UserForm>) => onChange({ ...form, ...fields });
  const departmentOptions = departments.map((d): [string, string] => [String(d.id), d.name]);
  return (
    <>
      <Field label="Ad soyad" error={problems.full_name}>
        {(c) => <Input {...c} value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} className="h-11" />}
      </Field>
      <Field label="E-posta" error={problems.email}>
        {(c) => <Input {...c} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className="h-11" />}
      </Field>
      <Field label="Rol" hint="Personel ve birim müdürü için birim, bildirim yapan için kullanıcı türü zorunlu.">
        {(c) => <Choice control={c} value={form.role} options={Object.entries(ROLE_LABELS)} onChange={(v) => set({ role: v as UserForm["role"] })} />}
      </Field>
      {form.role === "REPORTER" ? (
        <Field label="Kullanıcı türü" error={problems.reporter_kind}>
          {(c) => (
            <Choice control={c} value={form.reporter_kind} options={Object.entries(REPORTER_KIND_LABELS)} placeholder="Seçin" onChange={(v) => set({ reporter_kind: v as UserForm["reporter_kind"] })} />
          )}
        </Field>
      ) : null}
      {needsDepartment(form.role) ? (
        <Field label="Birim" error={problems.department_id}>
          {(c) => <Choice control={c} value={form.department_id} options={departmentOptions} placeholder="Seçin" onChange={(v) => set({ department_id: v })} />}
        </Field>
      ) : null}
      {mode === "create" ? (
        <Field label="Parola" error={problems.password} hint="En az 8 karakter.">
          {(c) => <Input {...c} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} className="h-11" />}
        </Field>
      ) : null}
    </>
  );
}
