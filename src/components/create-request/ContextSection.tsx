import { useState, useEffect, forwardRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Sparkles, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContextSectionProps {
  form: UseFormReturn<any>;
  draftSaveState: 'idle' | 'saving' | 'saved';
  autoFocus?: boolean;
}

export const ContextSection = forwardRef<HTMLTextAreaElement, ContextSectionProps>(
  ({ form, draftSaveState, autoFocus = true }, descriptionRef) => {
    const [showCommentField, setShowCommentField] = useState(false);
    const [isImprovingDescription, setIsImprovingDescription] = useState(false);
    const { toast } = useToast();

    // Show comment field if there's existing content
    const commentsValue = form.watch("comments");
    useEffect(() => {
      if (commentsValue && typeof commentsValue === 'string' && commentsValue.trim()) {
        setShowCommentField(true);
      }
    }, [commentsValue]);

    const handleImproveDescription = async () => {
      const currentDescription = form.getValues("description");
      if (!currentDescription || currentDescription.trim().length < 3) {
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
          body: { description: currentDescription },
        });

        if (error) throw error;

        if (data?.improved) {
          form.setValue("description", data.improved);
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

    // Draft indicator component
    const DraftIndicator = () => {
      if (draftSaveState === 'idle') return null;
      
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {draftSaveState === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Сохранение...</span>
            </>
          )}
          {draftSaveState === 'saved' && (
            <>
              <Check className="h-3 w-3 text-success" />
              <span>Черновик сохранён</span>
            </>
          )}
        </div>
      );
    };

    return (
      <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
        {/* Description - Primary, Autofocus */}
        <div className="p-3.5 sm:p-5 pb-2 sm:pb-3">
          <div className="flex items-center justify-between mb-2">
            <FormLabel className="text-sm sm:text-base font-medium text-foreground">
              Описание заявки *
            </FormLabel>
            <div className="flex items-center gap-2">
              <DraftIndicator />
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
                Улучшить
              </Button>
            </div>
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    ref={descriptionRef}
                    placeholder="Опишите заявку — это главное поле..."
                    className={cn(
                      "min-h-[60px] sm:min-h-[72px] resize-none border-0 p-0 text-base sm:text-lg leading-normal",
                      "focus-visible:ring-0 focus-visible:ring-offset-0",
                      "bg-transparent placeholder:text-muted-foreground/50 font-normal"
                    )}
                    autoFocus={autoFocus}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Comment - Collapsible, shown on demand */}
        {showCommentField ? (
          <>
            <div className="mx-3 sm:mx-4 border-t border-border/30" />
            <div className="p-3 sm:p-4 pt-2 sm:pt-3">
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Комментарий</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Дополнительная информация..."
                        className={cn(
                          "min-h-[50px] sm:min-h-[60px] resize-none border-0 p-0 text-sm leading-relaxed",
                          "focus-visible:ring-0 focus-visible:ring-offset-0",
                          "bg-transparent text-muted-foreground placeholder:text-muted-foreground/40"
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        ) : (
          <div className="px-3 sm:px-4 pb-2 sm:pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentField(true)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Добавить комментарий
            </Button>
          </div>
        )}
      </div>
    );
  }
);

ContextSection.displayName = "ContextSection";
