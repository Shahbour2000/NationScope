"use client";

import { useCallback, useSyncExternalStore } from "react";
import { PIN_KEY, hasPin, parsePins, serializePins, togglePin, removePin, type Pin, type PinType } from "./store";

const listeners = new Set<() => void>();
let memory: string | null = null; // used if localStorage is unavailable (private mode, blocked)
const EMPTY = "[]";

function read(): string {
  try { return localStorage.getItem(PIN_KEY) ?? memory ?? EMPTY; } catch { return memory ?? EMPTY; }
}
function write(pins: Pin[]): void {
  const json = serializePins(pins);
  memory = json;
  try { localStorage.setItem(PIN_KEY, json); } catch { /* keep the in-memory copy */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === PIN_KEY || e.key === null) cb(); };
  window.addEventListener("storage", onStorage); // other tabs
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

/** Pins are read through useSyncExternalStore with an empty server snapshot, so SSR and hydration always agree. */
export function usePins() {
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY);
  const pins = parsePins(raw);
  const toggle = useCallback((pin: Pin) => write(togglePin(parsePins(read()), pin)), []);
  const remove = useCallback((type: PinType, id: string) => write(removePin(parsePins(read()), type, id)), []);
  const has = useCallback((type: PinType, id: string) => hasPin(parsePins(raw), type, id), [raw]);
  return { pins, toggle, remove, has };
}
