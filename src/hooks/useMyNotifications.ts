import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "./useOrgMembership";
export function useMyNotifications(page=0,pageSize=10){
 const {data:userId}=useAuthUserId();const qc=useQueryClient();
 const list=useQuery({queryKey:["my-notifications",userId,page,pageSize],enabled:!!userId,staleTime:30000,queryFn:async()=>{const {data,count,error}=await supabase.from("notifications").select("*",{count:"exact"}).eq("user_id",userId??"").order("created_at",{ascending:false}).order("id").range(page*pageSize,page*pageSize+pageSize-1);if(error)throw error;return{rows:data??[],count:count??0};}});
 const mark=useMutation({mutationFn:async(id?:string)=>{if(!userId)return;let q=supabase.from("notifications").update({is_read:true}).eq("user_id",userId).eq("is_read",false);if(id)q=q.eq("id",id);const{error}=await q;if(error)throw error;},onSuccess:()=>{void qc.invalidateQueries({queryKey:["my-notifications"]});void qc.invalidateQueries({queryKey:["notifications"]});}});
 return {list,mark};
}
