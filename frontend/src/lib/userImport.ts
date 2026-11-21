// Toplu kullanici yukleme kurallari (docs/API.md "Toplu yukleme"). Son karar backend'in; burada istek
// gitmeden soylenebilenler denetlenir.
import { resetPasswordProblem } from "@/lib/password";

// Backend siniri 1 MB (413); daha buyuk dosya hic gonderilmez
export const IMPORT_MAX_BYTES = 1024 * 1024;
// Indirme baglantisi: public/templates (docs/templates'teki asil dosyanin kopyasi, test ayni kalmasini denetler)
export const IMPORT_TEMPLATE_HREF = "/templates/kullanici-yukleme-ornek.csv";

export interface ImportForm {
  file: File | null;
  password: string;
}

export type ImportProblems = Partial<Record<keyof ImportForm, string>>;

export function importProblems({ file, password }: ImportForm): ImportProblems {
  const problems: ImportProblems = {};
  if (!file) {
    problems.file = "CSV dosyası seçin.";
  } else if (file.size > IMPORT_MAX_BYTES) {
    problems.file = "Dosya en fazla 1 MB olabilir.";
  }
  const passwordProblem = resetPasswordProblem(password);
  if (passwordProblem) {
    problems.password = passwordProblem;
  }
  return problems;
}

export function errorSummary(count: number): string {
  return (
    `Dosyada ${count} hatalı satır var. Hiçbir kullanıcı eklenmedi; ` +
    "satırları düzeltip yeniden kontrol edin."
  );
}
