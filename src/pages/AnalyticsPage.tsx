import { useMemo } from "react";
import { useRequests } from "@/hooks/useRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { ClosureTimeAnalytics } from "@/components/analytics/ClosureTimeAnalytics";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AnalyticsPage = () => {
  const { data: requests, isLoading } = useRequests();
  const currentYear = new Date().getFullYear().toString();

  if (isLoading) {
    return (
      <div className="w-full p-2 sm:p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Аналитика</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Статистика и графики по заявкам
        </p>
      </div>

      {!requests || requests.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Недостаточно данных для аналитики</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Обзор</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm">Производительность</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs sm:text-sm">Расходы</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <RequestsAnalytics requests={requests} allRequests={requests} />
          </TabsContent>
          <TabsContent value="performance">
            <ClosureTimeAnalytics requests={requests as any} />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpenseChart requests={requests} selectedYear={currentYear} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AnalyticsPage;
