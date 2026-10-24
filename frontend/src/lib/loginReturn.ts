// Giristen sonra donulecek adres. Kullanicidan gelen her "next" adresine gidilmez (acik yonlendirme riski):
// yalniz kapidaki QR'in actigi bildirim formu (/report?location=<id>) kabul edilir, gerisi ana sayfadir.
const QR_REPORT_PATH = /^\/report\?location=\d+$/;
const HOME = "/";
const LOGIN = "/login";

export function safeReturnPath(next: string | null | undefined): string {
  return next && QR_REPORT_PATH.test(next) ? next : HOME;
}

// Oturumu olmayan ziyaretci giris sayfasina gonderilirken QR adresi "next" ile tasinir
export function loginHref(pathname: string, search: string): string {
  const current = `${pathname}${search}`;
  return safeReturnPath(current) === HOME ? LOGIN : `${LOGIN}?next=${encodeURIComponent(current)}`;
}
