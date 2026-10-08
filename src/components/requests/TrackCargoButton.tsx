import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCarrierTracker } from "@/lib/carrierTracking";

interface Props {
  carrier: string | null | undefined;
  ttn: string | null | undefined;
  className?: string;
}

/** Копирует ТТН и открывает страницу отслеживания перевозчика. */
export const TrackCargoButton = ({ carrier, ttn, className }: Props) => {
  const value = ttn?.trim();
  if (!value) return null;
  const tracker = getCarrierTracker(carrier, value);
  if (!tracker) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Открываем окно синхронно, чтобы браузер не заблокировал его.
    window.open(tracker.url, "_blank", "noopener,noreferrer");
    navigator.clipboard?.writeText(value).catch(() => undefined);
    toast.success(
      tracker.direct ? "ТТН скопирован, открываю отслеживание" : "ТТН скопирован — вставьте его на сайте ТК (Ctrl+V)"
    );
  };

  return (
    <button
      type="button"
      data-row-action
      onClick={handleClick}
      title={`Отследить груз (${carrier})`}
      aria-label="Отследить груз"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary",
        className
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </button>
  );
};
