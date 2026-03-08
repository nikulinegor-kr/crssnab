import { useRequests } from "@/hooks/useRequests";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { ClosureTimeAnalytics } from "@/components/analytics/ClosureTimeAnalytics";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { PurchasesByObjectChart } from "@/components/analytics/PurchasesByObjectChart";
import { PurchasesBySupplierChart } from "@/components/analytics/PurchasesBySupplierChart";
import { ExpensesByEquipmentChart } from "@/components/analytics/ExpensesByEquipmentChart";
import { RequestDynamicsChart } from "@/components/analytics/RequestDynamicsChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

const AnalyticsPage = () => {
  const { data: requests, isLoading } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const currentYear = new Date().getFullYear().toString();

  const { data: objects = [] } = useQuery({
    queryKey: ["analytics-objects", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["analytics-equipment", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

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
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Обзор</TabsTrigger>
            <TabsTrigger value="breakdown" className="text-xs sm:text-sm">Разрезы</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm">Производительность</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs sm:text-sm">Расходы</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="space-y-4">
              <RequestsAnalytics requests={requests} allRequests={requests} />
              <RequestDynamicsChart requests={requests} />
            </div>
          </TabsContent>
          <TabsContent value="breakdown">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PurchasesByObjectChart requests={requests} objects={objects} />
              <PurchasesBySupplierChart requests={requests} />
              <ExpensesByEquipmentChart requests={requests} equipment={equipment} />
            </div>
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
