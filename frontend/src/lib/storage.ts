// Gizli sekme ya da engellenmis site verisi: tarayici deposu hata atar; o zaman ozellik bu oturumda calismaz,
// ekran yine de kullanilir. Yalniz DOMException beklenir, baska hata yukari firlatilir.
export function withStorage<T>(run: (storage: Storage) => T, fallback: T): T {
  try {
    return run(window.localStorage);
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
    return fallback;
  }
}
