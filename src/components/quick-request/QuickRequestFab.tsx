import { Zap } from "lucide-react";
import { useQuickRequest } from "./QuickRequestProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface QuickRequestFabProps {
  className?: string;
}

export const QuickRequestFab = ({ className }: QuickRequestFabProps) => {
  const { open } = useQuickRequest();

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={open}
      aria-label="Быстрая заявка"
      title="Быстрая заявка (Cmd/Ctrl+Shift+Q)"
      className={cn(
        "fixed z-40 right-4 flex items-center justify-center",
        "h-14 w-14 rounded-md border border-input active:scale-95 transition-transform",
        // Above mobile bottom-nav, respects safe-area
        "bottom-[calc(env(safe-area-inset-bottom)+1rem+64px)] md:bottom-6",
        className,
      )}

    >
      <Zap className="h-6 w-6" />
    </Button>
  );
};
