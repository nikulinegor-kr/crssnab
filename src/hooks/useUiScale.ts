import { useCallback, useSyncExternalStore } from "react";

export type UiScale = 100 | 110 | 125;

export const UI_SCALES: UiScale[] = [100, 110, 125];
const STORAGE_KEY = "ui-scale";
const ROOT_FONT_SIZE: Record<UiScale, string> = {
  100: "16px",
  110: "17.6px",
  125: "20px",
};

const listeners = new Set<() => void>();

const read = (): UiScale => {
  if (typeof window === "undefined") return 100;
  const raw = Number(window.localStorage.getItem(STORAGE_KEY));
  return (UI_SCALES as number[]).includes(raw) ? (raw as UiScale) : 100;
};

let current: UiScale = read();

/** Масштаб интерфейса через корневой font-size: высота строк таблицы не затрагивается. */
export const applyUiScale = (scale: UiScale) => {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = ROOT_FONT_SIZE[scale];
  document.documentElement.dataset.uiScale = String(scale);
};

export const setUiScale = (scale: UiScale) => {
  current = scale;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    /* private mode */
  }
  applyUiScale(scale);
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useUiScale = () => {
  const scale = useSyncExternalStore(
    subscribe,
    () => current,
    () => 100 as UiScale
  );
  const setScale = useCallback((next: UiScale) => setUiScale(next), []);
  return { scale, setScale };
};

// Применяем сохранённый масштаб сразу при загрузке модуля.
applyUiScale(current);
