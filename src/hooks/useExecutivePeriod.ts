import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allRows } from "./useExecutivePanel";
import type { ExecutiveRequest } from "@/lib/executiveInsights";
/** Event dates, not request creation dates, define the reporting period. */
export function useExecutivePeriod(orgId:string|null,from:string,until:string,canReadWarehouse=true){
 const completed=useQuery({queryKey:["executive",orgId,"completed",from,until],enabled:Boolean(orgId),staleTime:60_000,queryFn:async():Promise<ExecutiveRequest[]>=>allRows((a,b)=>supabase.from("requests").select("id,description,status,priority,executor,created_at,planned_delivery_date,delivery_date,actual_arrival_date").eq("organization_id",orgId!).eq("is_project",false).in("status",["Доставлено","Выполнено"]).gte("actual_arrival_date",from).lt("actual_arrival_date",until).order("id").range(a,b))});
 const warehouse=useQuery({queryKey:["executive",orgId,"warehouse-documents",from,until],enabled:Boolean(orgId)&&canReadWarehouse,staleTime:60_000,queryFn:async()=>allRows((a,b)=>supabase.from("warehouse_documents").select("id,doc_type").eq("organization_id",orgId!).eq("status","posted").gte("posted_at",from).lt("posted_at",until).order("id").range(a,b))});
 return{completed,warehouse};
}
