import { useCallback, useState } from "react";

export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 720;
export const PANEL_DEFAULT_WIDTH = 520;
const PANEL_WIDTH_KEY = "requests-side-panel-width";

const clamp = (value: number) => Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, value));

/** Панель заявки — ширина колонки раскладки, запоминается на пользователя. */
export function useRequestPanelWidth() {
  const [width, setWidthState] = useState<number>(() => {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return Number.isFinite(saved) && saved > 0 ? clamp(saved) : PANEL_DEFAULT_WIDTH;
  });

  const setWidth = useCallback((next: number) => {
    const value = clamp(next);
    setWidthState(value);
    localStorage.setItem(PANEL_WIDTH_KEY, String(value));
  }, []);

  return { width, setWidth };
}
