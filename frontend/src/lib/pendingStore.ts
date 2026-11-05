// Cevrimdisi bildirim sirasinin saklandigi yer. Fotograflar da saklandigi icin localStorage degil IndexedDB
// (dosyalari oldugu gibi tutar). IndexedDB yoksa (eski tarayici, bazi gizli pencereler) sira kapali: bildirim
// eskisi gibi hata verir. Testlerde ayni arayuzle bellek ici depo kullanilir.
import type { PendingReport } from "./pendingReports";

export interface PendingStore {
  list(userId: number): Promise<PendingReport[]>;
  put(report: PendingReport): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = "bakircayflow";
const DB_VERSION = 1;
const STORE = "pending-reports";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB istegi basarisiz"));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const open = factory.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    open.result.createObjectStore(STORE, { keyPath: "id" });
  };
  return request(open);
}

type StoreRequest<T> = (store: IDBObjectStore) => IDBRequest<T>;

async function withStore<T>(factory: IDBFactory, mode: IDBTransactionMode, run: StoreRequest<T>) {
  const db = await openDb(factory);
  try {
    return await request(run(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

function idbStore(factory: IDBFactory): PendingStore {
  return {
    async list(userId) {
      const all = await withStore<PendingReport[]>(factory, "readonly", (store) => store.getAll());
      return all.filter((report) => report.userId === userId).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    },
    async put(report) {
      await withStore(factory, "readwrite", (store) => store.put(report));
    },
    async remove(id) {
      await withStore(factory, "readwrite", (store) => store.delete(id));
    },
  };
}

export function memoryStore(initial: PendingReport[] = []): PendingStore & { items: PendingReport[] } {
  const items = [...initial];
  return {
    items,
    async list(userId) {
      return items.filter((report) => report.userId === userId);
    },
    async put(report) {
      const index = items.findIndex((item) => item.id === report.id);
      items.splice(index === -1 ? items.length : index, index === -1 ? 0 : 1, report);
    },
    async remove(id) {
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) {
        items.splice(index, 1);
      }
    },
  };
}

// undefined: tarayicinin deposu kullanilir; testler kendi deposunu (ya da null: sira kapali) verir
let override: PendingStore | null | undefined;

export function setPendingStore(store: PendingStore | null | undefined): void {
  override = store;
}

export function pendingStore(): PendingStore | null {
  if (override !== undefined) {
    return override;
  }
  return typeof indexedDB === "undefined" ? null : idbStore(indexedDB);
}
