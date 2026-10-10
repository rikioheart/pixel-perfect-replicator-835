import { useSyncExternalStore } from "react";

/** Sections du menu ouvertes, conservées entre pages, rechargements partiels et complets. */
const KEY = "lvdc.nav.open";
const g = globalThis as typeof globalThis & { __lvdcNavOpen?: { open: Set<string>; subs: Set<() => void>; loaded: boolean } };
const store = (g.__lvdcNavOpen ??= { open: new Set(), subs: new Set(), loaded: false });

function load() {
  if (store.loaded || typeof window === "undefined") return;
  store.loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) store.open = new Set(raw.filter((v) => typeof v === "string"));
    else store.open = new Set();
  } catch {
    store.open = new Set();
  }
  if (window.localStorage.getItem("lvdc.nav.more") === "1") store.open.add("__more");
}

let snapshot = "";
function getSnapshot() {
  load();
  const next = [...store.open].sort().join("|");
  if (next !== snapshot) snapshot = next;
  return snapshot;
}

export function setNavSectionOpen(id: string, open: boolean) {
  load();
  if (open === store.open.has(id)) return;
  if (open) store.open.add(id);
  else store.open.delete(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...store.open]));
  } catch {
    /* stockage indisponible : l'état reste en mémoire */
  }
  store.subs.forEach((fn) => fn());
}

export function useNavSectionsOpen(): (id: string) => boolean {
  const snap = useSyncExternalStore(
    (fn) => {
      store.subs.add(fn);
      return () => store.subs.delete(fn);
    },
    getSnapshot,
    () => "",
  );
  const set = new Set(snap ? snap.split("|") : []);
  return (id) => set.has(id);
}
