import { useCallback, useEffect, useRef, useState } from "react";

export const REQUEST_CARD_AUTO_CLOSE_MS = 7000;

export function useRequestCardTimer({
  open,
  resetKey,
  pinned,
  paused,
  onClose,
}: {
  open: boolean;
  resetKey?: string | null;
  pinned: boolean;
  paused: boolean;
  onClose: () => void;
}) {
  const deadlineRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const [remainingMs, setRemainingMs] = useState(REQUEST_CARD_AUTO_CLOSE_MS);
  onCloseRef.current = onClose;

  const restart = useCallback(() => {
    if (!open || pinned || paused) return;
    deadlineRef.current = Date.now() + REQUEST_CARD_AUTO_CLOSE_MS;
    setRemainingMs(REQUEST_CARD_AUTO_CLOSE_MS);
  }, [open, paused, pinned]);

  useEffect(() => {
    if (!open) return;
    deadlineRef.current = Date.now() + REQUEST_CARD_AUTO_CLOSE_MS;
    setRemainingMs(REQUEST_CARD_AUTO_CLOSE_MS);
  }, [open, resetKey]);

  useEffect(() => {
    if (!open || pinned || paused) return;
    deadlineRef.current = Date.now() + REQUEST_CARD_AUTO_CLOSE_MS;
    setRemainingMs(REQUEST_CARD_AUTO_CLOSE_MS);
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        onCloseRef.current();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [open, paused, pinned]);

  return {
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    restart,
  };
}
