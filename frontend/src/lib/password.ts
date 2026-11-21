// Parola kurallari: backend ile ayni (backend/app/schemas/user.py PASSWORD_MIN_LENGTH); istek gitmeden soylenir
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordForm {
  current: string;
  next: string;
  repeat: string;
}

export type PasswordProblems = Partial<Record<keyof PasswordForm, string>>;

const TOO_SHORT = `en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;

export function passwordProblems(form: PasswordForm): PasswordProblems {
  const problems: PasswordProblems = {};
  if (form.current === "") {
    problems.current = "Mevcut parolayı yazın.";
  }
  if (form.next.length < PASSWORD_MIN_LENGTH) {
    problems.next = `Yeni parola ${TOO_SHORT}`;
  } else if (form.next === form.current) {
    // Backend'in SAME_PASSWORD mesajiyla ayni
    problems.next = "Yeni parola mevcut parolayla aynı olamaz.";
  }
  if (!problems.next && form.repeat !== form.next) {
    problems.repeat = "Yeni parolalar aynı değil.";
  }
  return problems;
}

// Yoneticinin verdigi gecici parola (POST /admin/users/{id}/password)
export function resetPasswordProblem(password: string): string | null {
  return password.length < PASSWORD_MIN_LENGTH ? `Geçici parola ${TOO_SHORT}` : null;
}
