// Sunucuya ulasilabiliyor mu? Tarayicinin navigator.onLine bilgisi yetmez: Windows'ta sanal ag kartlari
// (Docker, WSL) acikken Wi-Fi kapali olsa da "bagliyim" der. Bu yuzden istekler de izlenir: ag hatasiyla
// dusen istek "ulasilamiyor", herhangi bir cevap (hata cevabi da) "ulasildi" demektir (client.ts deliver).
type Listener = () => void;

let reachable = true;
const listeners = new Set<Listener>();

export function isServerReachable(): boolean {
  return reachable;
}

export function markServerReachable(value: boolean): void {
  if (value === reachable) {
    return;
  }
  reachable = value;
  listeners.forEach((listener) => listener());
}

export function subscribeReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
