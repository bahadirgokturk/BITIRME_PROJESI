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
