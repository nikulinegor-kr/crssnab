import { useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRecognizedWaybill, type RecognizedWaybill } from "@/lib/recognizeWaybill";

interface Props {
  onRecognized: (data: RecognizedWaybill) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export const RecognizeWaybillButton = ({ onRecognized, disabled, className }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const { data, error } = await supabase.functions.invoke("recognize-shipment", {
        body: { file: dataUrl, fileType: file.type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = normalizeRecognizedWaybill(data);
      if (!result.transport_company && !result.waybill_number && !result.shipment_date && !result.delivery_date) {
        toast.error("В документе не найдены данные ТТН");
        return;
      }
      await onRecognized(result);
      toast.success("ТТН распознана", { description: "Проверьте заполненные поля" });
    } catch (e: any) {
      toast.error("Не удалось распознать ТТН", { description: e?.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ScanLine className="h-3.5 w-3.5 mr-1" />}
        {busy ? "Распознаём…" : "Распознать ТТН"}
      </Button>
    </>
  );
};
