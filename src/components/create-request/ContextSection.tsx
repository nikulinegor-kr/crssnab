import { useState, useEffect, forwardRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Check } from "lucide-react";
import { RequestTextPolish } from "./RequestTextPolish";

interface ContextSectionProps {
  form: UseFormReturn<any>;
  draftSaveState: 'idle' | 'saving' | 'saved';
  showDraftStatus?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

export const ContextSection = forwardRef<HTMLTextAreaElement, ContextSectionProps>(
  ({ form, draftSaveState, showDraftStatus = true, autoFocus = true, disabled = false }, descriptionRef) => {
    const [showCommentField, setShowCommentField] = useState(false);

    // Show comment field if there's existing content
    const justificationNotRequired = form.watch("justification_not_required") === true;
    const commentsValue = form.watch("comments");
    useEffect(() => {
      if (commentsValue && typeof commentsValue === 'string' && commentsValue.trim()) {
        setShowCommentField(true);
      }
    }, [commentsValue]);

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
      <div className="req-a-ctx request-context">
        {/* Description - Primary, Autofocus */}
        <div className="p-3.5 sm:p-5 pb-2 sm:pb-3">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <FormLabel className="text-sm sm:text-base font-medium text-foreground">
                    Описание заявки *
                  </FormLabel>
                  {showDraftStatus && <DraftIndicator />}
                </div>
                <FormControl>
                  <Textarea
                    ref={descriptionRef}
                    placeholder="Например, комплект фильтров для дорожного катка"
                    className="request-description-input min-h-[76px] resize-y text-sm leading-normal"
                    autoFocus={autoFocus && !disabled}
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <RequestTextPolish field="description" value={field.value ?? ""} disabled={disabled} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="px-3.5 pb-3 sm:px-5">
          <FormField
            control={form.control}
            name="justification_not_required"
            render={({ field }) => (
              <label className="mb-2 inline-flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="request-justification-checkbox accent-primary" checked={field.value === true}
                  disabled={disabled} onChange={event => {
                    field.onChange(event.target.checked);
                    if (event.target.checked) form.clearErrors("applicant_justification");
                  }} />
                Обоснование не требуется
              </label>
            )}
          />
          <FormField
            control={form.control}
            name="applicant_justification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Обоснование заявителя{!justificationNotRequired && " *"}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    disabled={disabled || justificationNotRequired}
                    aria-required={!justificationNotRequired}
                    maxLength={2000}
                    placeholder="Зачем нужна закупка?"
                    className="min-h-[64px] resize-y text-sm leading-relaxed"
                  />
                </FormControl>
                <RequestTextPolish field="applicant_justification" value={field.value ?? ""} disabled={disabled || justificationNotRequired} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Comment - disclosure, opened automatically when it has content */}
        <details className="request-disclosure mx-3.5 sm:mx-5 mb-3" open={showCommentField || undefined} onToggle={(e) => setShowCommentField((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>Комментарий</summary>
          <FormField
            control={form.control}
            name="comments"
            render={({ field }) => (
              <FormItem className="mt-2">
                <FormLabel className="sr-only">Комментарий</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Дополнительная информация..."
                    className="min-h-[64px] resize-y text-sm leading-relaxed"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </details>
      </div>
    );
  }
);

ContextSection.displayName = "ContextSection";
