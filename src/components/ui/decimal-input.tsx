import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DecimalInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
};

/**
 * Text input for money/decimals that supports comma (",") and dot (".") as decimal separators.
 * Stores numeric value (number|null) via onValueChange.
 */
export function DecimalInput({
  value,
  onValueChange,
  className,
  disabled,
  placeholder,
  ...props
}: DecimalInputProps) {
  const [text, setText] = React.useState<string>(value == null ? "" : String(value).replace(".", ","));
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (isEditing) return;
    setText(value == null ? "" : String(value).replace(".", ","));
  }, [value, isEditing]);

  const normalize = (raw: string) => {
    // Allow digits + one decimal separator (comma or dot)
    let cleaned = raw.replace(/\s+/g, "").replace(/[^\d.,]/g, "");

    const firstSepIndex = cleaned.search(/[.,]/);
    if (firstSepIndex !== -1) {
      const before = cleaned.slice(0, firstSepIndex).replace(/[.,]/g, "");
      const after = cleaned.slice(firstSepIndex + 1).replace(/[.,]/g, "");
      cleaned = `${before},${after}`;
    } else {
      cleaned = cleaned.replace(/[.,]/g, "");
    }

    return cleaned;
  };

  const parseToNumber = (raw: string): number | null => {
    const normalized = raw.replace(",", ".");
    if (!normalized || normalized === ".") return null;
    const n = Number.parseFloat(normalized);
    if (Number.isNaN(n)) return null;
    return n;
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      className={cn(className)}
      value={text}
      onFocus={(e) => {
        setIsEditing(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsEditing(false);
        // Re-format from numeric value (if any)
        const parsed = parseToNumber(text);
        onValueChange(parsed);
        setText(parsed == null ? "" : String(parsed).replace(".", ","));
        props.onBlur?.(e);
      }}
      onChange={(e) => {
        const next = normalize(e.target.value);
        setText(next);
        onValueChange(parseToNumber(next));
      }}
    />
  );
}
