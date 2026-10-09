import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";

export interface ControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: ControlProps) => ReactNode;
}

// Etiket + alan + hata/ipucu; hata alanin altinda ve alana bagli (UI_GUIDE bolum 6 ve 8)
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": note ? noteId : undefined })}
      {note ? (
        <p id={noteId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:bg-muted disabled:opacity-100";

interface ChoiceProps {
  control: ControlProps;
  value: string;
  options: readonly [string, string][];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Secim kutusu; placeholder verilirse bos deger de secilebilir
export function Choice({ control, value, options, onChange, placeholder, disabled }: ChoiceProps) {
  return (
    <select
      {...control}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={SELECT_CLASS}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
