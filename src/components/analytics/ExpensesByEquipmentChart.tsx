import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Request } from "@/hooks/useRequests";

interface Props {
  requests: Request[];
  equipment: Array<{ id: string; brand: string; model: string }>;
}

export const ExpensesByEquipmentChart = ({ requests, equipment }: Props) => {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((r) => {
      if (!r.equipment_id || !r.amount) return;
      map.set(r.equipment_id, (map.get(r.equipment_id) || 0) + Number(r.amount));
    });
    return equipment
      .map((e) => {
        const label = `${e.brand} ${e.model}`;
        return { name: label.length > 20 ? label.slice(0, 20) + "…" : label, amount: map.get(e.id) || 0 };
      })
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [requests, equipment]);

  if (data.length === 0) return null;

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Расходы по технике</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString("ru-RU")} ₽`, "Сумма"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="amount" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
