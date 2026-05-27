import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Paperclip, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import type { PlannerAttachment } from "@/hooks/usePlannerTasks";

interface Props {
  value: PlannerAttachment[];
  onChange: (next: PlannerAttachment[]) => void;
}

const BUCKET = "planner-attachments";

export function PlannerAttachmentsField({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  const upload = async (files: FileList | null) => {
    if (!files || !files.length || !currentOrgId) return;
    setBusy(true);
    try {
      const next: PlannerAttachment[] = [...value];
      for (const f of Array.from(files)) {
        const path = `${currentOrgId}/${crypto.randomUUID()}-${f.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
          contentType: f.type || undefined,
        });
        if (error) throw error;
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
        next.push({
          name: f.name,
          path,
          url: signed?.signedUrl ?? "",
          size: f.size,
          mime: f.type,
        });
      }
      onChange(next);
    } catch (e: any) {
      toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  };

  const remove = async (att: PlannerAttachment) => {
    if (att.path) await supabase.storage.from(BUCKET).remove([att.path]);
    onChange(value.filter((a) => a.path !== att.path && a.url !== att.url));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Paperclip className="h-3.5 w-3.5 mr-1" />}
          Файл
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()} disabled={busy}>
          <Camera className="h-3.5 w-3.5 mr-1" /> Фото
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((a, i) => {
            const isImg = a.mime?.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(a.name);
            return (
              <div key={i} className="relative rounded-md border border-border/50 overflow-hidden bg-muted/20 group">
                {isImg && a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                  </a>
                ) : (
                  <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 text-xs h-24">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(a)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
