import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  tone?: "default" | "danger" | "warning" | "success";
};

const toneMap: Record<NonNullable<Props["tone"]>, string> = {
  default: "",
  danger: "text-destructive",
  warning: "text-warning dark:text-warning",
  success: "text-success dark:text-success",
};

export function MetricCard({ label, value, hint, to, tone = "default" }: Props) {
  const inner = (
    <Card
      className={cn(
        "p-4 transition-colors h-full",
        to && "hover:border-primary/40 hover:shadow-sm cursor-pointer",
      )}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold font-numeric", toneMap[tone])}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
