import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RequestContextBlockProps {
  description: string;
  comments?: string | null;
  canEdit: boolean;
  onUpdate?: (updates: { description?: string; comments?: string }) => void;
  autoFocus?: boolean;
  mode?: "view" | "edit";
}

export const RequestContextBlock = ({
  description,
  comments,
  canEdit,
  onUpdate,
  autoFocus = false,
  mode = "view",
}: RequestContextBlockProps) => {
  const [isEditing, setIsEditing] = useState(mode === "edit");
  const [localDescription, setLocalDescription] = useState(description);
  const [localComments, setLocalComments] = useState(comments || "");
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Sync with external values
  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  useEffect(() => {
    setLocalComments(comments || "");
  }, [comments]);

  // Auto-focus on description when entering edit mode
  useEffect(() => {
    if ((isEditing || autoFocus) && descriptionRef.current) {
      descriptionRef.current.focus();
      descriptionRef.current.setSelectionRange(
        descriptionRef.current.value.length,
        descriptionRef.current.value.length
      );
    }
  }, [isEditing, autoFocus]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        description: localDescription,
        comments: localComments || undefined,
      });
    }
    setIsEditing(false);
  };

  const handleImproveDescription = async () => {
    if (!localDescription || localDescription.trim().length < 3) {
      toast({
        title: "Введите описание",
        description: "Сначала введите описание заявки для улучшения",
        variant: "destructive",
      });
      return;
    }

    setIsImprovingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-description", {
        body: { description: localDescription },
      });

      if (error) throw error;

      if (data?.improved) {
        setLocalDescription(data.improved);
        toast({
          title: "Описание улучшено",
          description: "AI переформулировал описание заявки",
        });
      }
    } catch (error: any) {
      console.error("Error improving description:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось улучшить описание",
        variant: "destructive",
      });
    } finally {
      setIsImprovingDescription(false);
    }
  };

  // Edit mode (inline or in dialog form)
  if (isEditing || mode === "edit") {
    return (
      <Card className="glassmorphism border-border/40 overflow-hidden">
        <CardContent className="p-0">
          {/* Description - primary */}
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">
                Описание заявки
              </label>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleImproveDescription}
                  disabled={isImprovingDescription}
                  className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                >
                  {isImprovingDescription ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Улучшить с AI
                </Button>
              )}
            </div>
            <Textarea
              ref={descriptionRef}
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              placeholder="Опишите заявку..."
              className={cn(
                "min-h-[100px] resize-none border-0 p-0 text-base leading-relaxed",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "bg-transparent placeholder:text-muted-foreground/50"
              )}
              disabled={!canEdit}
              autoFocus={autoFocus}
            />
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-border/30" />

          {/* Comments - secondary */}
          <div className="p-4 pt-3">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Комментарий
            </label>
            <Textarea
              value={localComments}
              onChange={(e) => setLocalComments(e.target.value)}
              placeholder="Добавить примечание..."
              className={cn(
                "min-h-[60px] resize-none border-0 p-0 text-sm leading-relaxed",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "bg-transparent text-muted-foreground placeholder:text-muted-foreground/40"
              )}
              disabled={!canEdit}
            />
          </div>

          {/* Save button for view mode edit */}
          {mode === "view" && canEdit && (
            <div className="px-4 pb-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Сохранить
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // View mode
  return (
    <Card 
      className={cn(
        "glassmorphism border-border/40 overflow-hidden group",
        canEdit && "cursor-pointer hover:border-primary/30 transition-colors"
      )}
      onClick={() => canEdit && setIsEditing(true)}
    >
      <CardContent className="p-0 relative">
        {/* Edit button overlay */}
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Description - primary */}
        <div className="p-4 pb-0">
          <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {description || <span className="text-muted-foreground italic">Нет описания</span>}
          </p>
        </div>

        {/* Comments - secondary (only show if exists) */}
        {comments && (
          <>
            <div className="mx-4 my-3 border-t border-border/30" />
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground/80 mb-1">Комментарий</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {comments}
              </p>
            </div>
          </>
        )}

        {/* No comments - subtle hint */}
        {!comments && (
          <div className="px-4 pb-4 pt-2">
            <p className="text-xs text-muted-foreground/50 italic">
              {canEdit ? "Нажмите для добавления комментария" : "Нет комментария"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
