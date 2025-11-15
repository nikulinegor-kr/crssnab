import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { AlertCircle } from "lucide-react";

interface PriorityChartWidgetProps {
  requests: Request[];
}

export function PriorityChartWidget({ requests }: PriorityChartWidgetProps) {
  const priorityOrder = ["Аварийно", "Срочно", "Плановая"];
  
  const priorityColors: Record<string, string> = {
    "Аварийно": "hsl(var(--destructive))",
    "Срочно": "hsl(var(--warning))",
    "Плановая": "hsl(var(--success))"
  };

  const priorityCounts = requests.reduce((acc, req) => {
    acc[req.priority] = (acc[req.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityData = priorityOrder
    .filter(priority => priorityCounts[priority] > 0)
    .map(priority => ({
      name: priority,
      value: priorityCounts[priority],
      color: priorityColors[priority] || "hsl(var(--muted))"
    }));

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Распределение по приоритетам
        </CardTitle>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {priorityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={priorityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Нет данных о приоритетах
          </p>
        )}
      </CardContent>
    </Card>
  );
}
