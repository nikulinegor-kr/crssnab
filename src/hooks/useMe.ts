import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfToday, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "./useOrgMembership";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { CLOSED_REQUEST_STATUSES } from "@/lib/requestStaleness";
import { taskStatistics } from "@/lib/personalCabinet";
import type { PlannerTask } from "./usePlannerTasks";
const closed=`(${CLOSED_REQUEST_STATUSES.map(s=>`"${s}"`).join(",")})`;
async function allRows<T>(page:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {const rows:T[]=[];for(let from=0;;from+=1000){const {data,error}=await page(from,from+999);if(error)throw error;rows.push(...(data??[]));if(!data || data.length<1000)return rows;}}
export function useMe(){
 const {data:userId}=useAuthUserId();const {currentOrgId:orgId}=useCurrentOrganization();const qc=useQueryClient();
 const today=startOfToday();const end=addDays(today,7);const options={enabled:!!userId,staleTime:60000};
 const identity=useQuery({...options,queryKey:["me",userId,orgId,"identity"],queryFn:async()=>{
  if(!userId)return null;
  const {data:profile,error}=await supabase.from("profiles").select("full_name,position,organization_name,telegram_user_id").eq("id",userId).single();if(error)throw error;
  let department:string|null=null;let organization=profile.organization_name;
  if(orgId){const {data:member,error:membershipError}=await supabase.from("user_organizations").select("department:departments(name),organization:organizations(name)").eq("user_id",userId).eq("organization_id",orgId).maybeSingle();if(membershipError)throw membershipError;department=member?.department?.name??null;organization=member?.organization?.name??organization;}
  return {...profile,department,organization};
 }});
 const tasks=useQuery({...options,queryKey:["me",userId,"tasks",format(today,"yyyy-MM-dd")],queryFn:async()=>{
  if(!userId)return[];
  const rows=await allRows((from,to)=>supabase.from("planner_tasks").select("*").is("archived_at",null).eq("hidden_auto",false).neq("status","done").or(`assignee_id.eq.${userId},co_assignee_ids.cs.{${userId}}`).order("due_date",{ascending:true,nullsFirst:false}).order("id").range(from,to));return rows as unknown as PlannerTask[];
 }});
 const reviews=useQuery({...options,queryKey:["me",userId,"reviews"],queryFn:async()=>{const {count,error}=await supabase.from("planner_tasks").select("id",{count:"exact",head:true}).is("archived_at",null).eq("hidden_auto",false).eq("reviewer_id",userId??"").eq("status","review");if(error)throw error;return count??0;}});
 const requests=useQuery({...options,queryKey:["me",userId,"requests"],queryFn:async()=>{if(!userId)return[];return allRows((from,to)=>supabase.from("requests").select("id,description,request_number,status,updated_at").eq("archived",false).eq("is_project",false).not("status","in",closed).or(`applicant_user_id.eq.${userId},created_by.eq.${userId}`).order("updated_at",{ascending:false}).order("id").range(from,to));}});
 const calendar=useQuery({...options,queryKey:["me",userId,"calendar",format(today,"yyyy-MM-dd")],queryFn:async()=>{if(!userId)return[];return allRows((from,to)=>supabase.from("calendar_events").select("id,title,start_date,request_id").eq("assignee_id",userId).gte("start_date",today.toISOString()).lt("start_date",end.toISOString()).order("start_date").order("id").range(from,to));}});
 const stats=useQuery({...options,queryKey:["me",userId,"stats",format(today,"yyyy-MM-dd")],queryFn:async()=>{
  if(!userId)return null;const since=subDays(new Date(),30).toISOString();
  const [done,owned]=await Promise.all([
   allRows((from,to)=>supabase.from("planner_tasks").select("completed_at,due_date,created_at").eq("status","done").or(`assignee_id.eq.${userId},co_assignee_ids.cs.{${userId}}`).gte("completed_at",since).order("id").range(from,to)),
   allRows((from,to)=>supabase.from("planner_tasks").select("id").or(`assignee_id.eq.${userId},co_assignee_ids.cs.{${userId}}`).order("id").range(from,to)),
  ]);
  let rework=0;for(let i=0;i<owned.length;i+=200){const {count,error}=await supabase.from("planner_task_activity").select("id",{count:"exact",head:true}).in("task_id",owned.slice(i,i+200).map(t=>t.id)).in("action",["status_change","status_changed"]).eq("new_value","rework").gte("created_at",since);if(error)throw error;rework+=count??0;}return taskStatistics(done,rework);
 }});
 useEffect(()=>{if(!userId)return;const channel=supabase.channel(`me-tasks-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"planner_tasks"},()=>void qc.invalidateQueries({queryKey:["me",userId]})).subscribe();return()=>{void supabase.removeChannel(channel);};},[userId,qc]);
 return {userId,orgId,today,end,identity,tasks,reviews,requests,calendar,stats};
}
