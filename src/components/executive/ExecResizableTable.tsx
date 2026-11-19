import { useEffect, useState, type ReactNode, type PointerEvent } from "react";

const KEY = "exec-queue-widths-v1";
type Widths = { title: number; comment: number };
const load = (): Widths => { try { const v = JSON.parse(localStorage.getItem(KEY) || ""); if (v.title > 0 && v.comment > 0) return v; } catch { /* default */ } return { title: 320, comment: 260 }; };

export function useQueueWidths() {
  const [w, setW] = useState<Widths>(load);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(w)); }, [w]);
  const handle = (col: keyof Widths) => (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault(); const start = e.clientX, base = w[col];
    const move = (ev: globalThis.PointerEvent) => setW(p => ({ ...p, [col]: Math.min(720, Math.max(160, base + ev.clientX - start)) }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const keyResize = (col: keyof Widths) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setW(p => ({ ...p, [col]: Math.min(720, Math.max(160, p[col] + (e.key === "ArrowRight" ? 20 : -20))) })); }
  };
  return { w, handle, keyResize };
}
export function ResizeTh({ label, onPointerDown, onKeyDown }: { label: ReactNode; onPointerDown: (e: PointerEvent<HTMLSpanElement>) => void; onKeyDown: (e: React.KeyboardEvent) => void }) {
  return <th className="exec-th exec-left">{label}<span role="separator" aria-orientation="vertical" aria-label="Изменить ширину колонки" tabIndex={0} className="exec-resize" onPointerDown={onPointerDown} onKeyDown={onKeyDown} /></th>;
}
