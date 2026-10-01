// Bildirim formunun kurallari (docs/UI_GUIDE.md bolum 5.1). Degerler backend ile ayni
// (backend/app/core/constants.py); burada denetlemek kullaniciyi sunucu cevabini beklemekten kurtarir,
// son karar yine backend'indir.
export const DESCRIPTION_MIN_LENGTH = 10; // CASE_DESCRIPTION_MIN_LENGTH
export const DESCRIPTION_MAX_LENGTH = 2000; // CASE_DESCRIPTION_MAX_LENGTH
export const REPORT_MAX_FILES = 5; // MAX_ATTACHMENTS_PER_CASE

const BYTES_PER_MB = 1024 * 1024;
const PHOTO_MAX_MB = 5; // MAX_UPLOAD_MB_DEFAULT
const VIDEO_MAX_MB = 50; // MAX_VIDEO_MB_DEFAULT (30 sn siniri dosyanin icinde; yalniz backend denetler)

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const REPORT_FILE_ACCEPT = [...PHOTO_TYPES, ...VIDEO_TYPES].join(",");

export function descriptionProblem(text: string): string | null {
  const length = text.trim().length;
  if (length < DESCRIPTION_MIN_LENGTH) {
    return `Açıklama en az ${DESCRIPTION_MIN_LENGTH} karakter olmalı.`;
  }
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `Açıklama en fazla ${DESCRIPTION_MAX_LENGTH} karakter olabilir.`;
  }
  return null;
}

export function isVideo(file: Pick<File, "type">): boolean {
  return VIDEO_TYPES.includes(file.type);
}

// Dosya sunucuya gonderilmeden denetlenir: buyuk dosyayi telefondan yukleyip reddedilmesini beklemek yavas
export function fileProblem(file: Pick<File, "type" | "size">): string | null {
  if (!PHOTO_TYPES.includes(file.type) && !isVideo(file)) {
    return "Yalnız JPG, PNG, WEBP fotoğraf ya da MP4, MOV video eklenebilir.";
  }
  if (isVideo(file)) {
    return file.size > VIDEO_MAX_MB * BYTES_PER_MB ? `Video en fazla ${VIDEO_MAX_MB} MB olabilir.` : null;
  }
  return file.size > PHOTO_MAX_MB * BYTES_PER_MB ? `Fotoğraf en fazla ${PHOTO_MAX_MB} MB olabilir.` : null;
}

export interface FileSelection {
  files: File[];
  problem: string | null;
}

// Secilen dosyalari listeye ekler; kullanilamayan dosya atlanir ve ilk sorun bildirilir
export function addFiles(current: File[], picked: File[]): FileSelection {
  const usable = picked.filter((file) => fileProblem(file) === null);
  const rejected = picked.find((file) => fileProblem(file) !== null);
  const files = [...current, ...usable].slice(0, REPORT_MAX_FILES);
  if (current.length + usable.length > REPORT_MAX_FILES) {
    return { files, problem: `En fazla ${REPORT_MAX_FILES} dosya eklenebilir.` };
  }
  return { files, problem: rejected ? fileProblem(rejected) : null };
}
