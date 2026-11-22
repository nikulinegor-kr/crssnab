import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { cn } from "@/lib/utils";

export interface RequestInlineOption {
  value: string;
  label: string;
}

interface RequestInlineFieldProps {
  label: string;
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<void> | void;
  type?: "text" | "textarea" | "number" | "date" | "select" | "combobox";
  options?: RequestInlineOption[];
  display?: React.ReactNode;
  readOnly?: boolean;
  hideLabel?: boolean;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
  saveOnChange?: boolean;
}

export function RequestInlineField({
  label,
  value,
  onSave,
  type = "text",
  options = [],
  display,
  readOnly = false,
  hideLabel = false,
  className,
  onEditingChange,
  saveOnChange = false,
}: RequestInlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const editingChangeRef = useRef(onEditingChange);

  useEffect(() => setDraft(String(value ?? "")), [value]);
  useEffect(() => { editingChangeRef.current = onEditingChange; }, [onEditingChange]);
  useEffect(() => { editingChangeRef.current?.(editing); }, [editing]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setDraft(String(value ?? ""));
    setEditing(false);
  };

  const save = async () => {
    if (draft === String(value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // Родитель показывает ошибку; редактор остаётся открытым для повторной попытки.
    } finally {
      setSaving(false);
    }
  };

  const shown = display ?? (value === null || value === undefined || value === "" ? "—" : String(value));

  return (
    <div className={cn("request-inline-field", hideLabel && "request-inline-field--title", className)}>
      {!hideLabel && <span className="request-inline-field__label">{label}</span>}
      <div className="request-inline-field__value">
        {editing && !readOnly ? (
          <div className="request-inline-field__editor" data-active-editor>
            {type === "combobox" ? (
              <ComboboxInput
                value={draft}
                onChange={setDraft}
                options={options}
                placeholder="Выберите или введите ТК"
                searchPlaceholder="Поиск ТК или введите новую"
                emptyMessage="Введите название вручную"
                allowCustomValue
                disabled={saving}
              />
            ) : type === "select" ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={draft}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft(next);
                  if (saveOnChange) {
                    // Сразу возвращаем компактный вид поля после выбора.
                    // Сохранение выполняется асинхронно в фоне.
                    setEditing(false);
                    setSaving(true);
                    void Promise.resolve(onSave(next)).finally(() => setSaving(false));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancel();
                  if (event.key === "Enter") void save();
                }}
                disabled={saving}
                aria-label={label}
              >
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : type === "textarea" ? (
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancel();
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void save();
                }}
                disabled={saving}
                aria-label={label}
                rows={3}
              />
            ) : (
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                min={type === "number" ? 0 : undefined}
                max={type === "number" ? 100 : undefined}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancel();
                  if (event.key === "Enter") void save();
                }}
                disabled={saving}
                aria-label={label}
              />
            )}
            {!saveOnChange && <div className="request-inline-field__actions">
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Сохранить
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={saving}>Отмена</Button>
            </div>}
          </div>
        ) : (
          <button
            type="button"
            className="request-inline-field__display"
            onClick={() => !readOnly && setEditing(true)}
            disabled={readOnly}
            aria-label={readOnly ? `${label}: ${String(value ?? "—")}` : `Изменить: ${label}`}
            title={readOnly ? undefined : "Нажать для редактирования"}
          >
            <span>{shown}</span>
          </button>
        )}
      </div>
    </div>
  );
}
