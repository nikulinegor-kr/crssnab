import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerProps {
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({ imageUrl, open, onOpenChange }: ImageViewerProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={imageUrl}
            alt="Просмотр изображения"
            className="w-full h-auto"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
