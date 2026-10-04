import { useEffect, useState } from "react";

// Deger degismeyi biraktiktan delayMs sonra guncellenir: her tus vurusunda istek atilmasin diye
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
