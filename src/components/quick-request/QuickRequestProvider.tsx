import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { QuickRequestSheet } from "./QuickRequestSheet";

interface QuickRequestContextValue {
  open: () => void;
  close: () => void;
}

const QuickRequestContext = createContext<QuickRequestContextValue | null>(null);

export const useQuickRequest = () => {
  const ctx = useContext(QuickRequestContext);
  if (!ctx) throw new Error("useQuickRequest must be used inside QuickRequestProvider");
  return ctx;
};

export const QuickRequestProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global keyboard shortcut: Cmd/Ctrl+Shift+Q
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      if (!isTyping && e.key.toLowerCase() === "q" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Disabled to avoid surprise; only shortcut is Cmd+Shift+Q
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QuickRequestContext.Provider value={{ open, close }}>
      {children}
      <QuickRequestSheet open={isOpen} onOpenChange={setIsOpen} />
    </QuickRequestContext.Provider>
  );
};
