import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CameraScanDialog({ open, onOpenChange, onResult }: { open: boolean; onOpenChange: (v: boolean) => void; onResult: (v: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let scanner: QrScanner | null = null;
    let done = false;
    const t = setTimeout(() => {
      if (!video.current) return;
      scanner = new QrScanner(
        video.current,
        (r) => {
          if (done) return;
          done = true;
          scanner?.stop();
          onResult(r.data);
          onOpenChange(false);
        },
        { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
      );
      scanner.start().catch(() => setError("Нет доступа к камере. Разрешите доступ или введите код вручную."));
    }, 50);
    return () => {
      clearTimeout(t);
      scanner?.stop();
      scanner?.destroy();
    };
  }, [open, onOpenChange, onResult]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setError(null); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Сканирование камерой</DialogTitle></DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : (
          <video ref={video} className="w-full aspect-square rounded-md bg-muted object-cover" muted playsInline />
        )}
        <p className="text-xs text-muted-foreground">Наведите камеру на QR ячейки, изделия или партии.</p>
      </DialogContent>
    </Dialog>
  );
}
