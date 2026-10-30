import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "./useOrgMembership";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { getWebPushState, vapidKeyBytes } from "@/lib/webPush";
export function useWebPush() {
  const { data: userId } = useAuthUserId();
  const { currentOrgId } = useCurrentOrganization();
  const qc=useQueryClient();
  const [subscribed,setSubscribed]=useState(false);
  const [permission,setPermission]=useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [pending,setPending]=useState(false);
  const config=useQuery({queryKey:["web-push-config",userId],enabled:!!userId,staleTime:60000,retry:false,queryFn:async()=>{
    const {data,error}=await supabase.functions.invoke("send-web-push?config=1",{method:"GET"});
    if(error) throw error;
    return data as {configured:boolean;publicKey:string};
  }});
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  const standalone=window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
  const supported="serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  useEffect(()=>{if(!supported)return;let cancelled=false;void navigator.serviceWorker.getRegistration().then(async reg=>{const sub=await reg?.pushManager.getSubscription();
      let registered=false;
      if(sub&&userId){const {count,error}=await supabase.from("device_push_tokens").select("id",{count:"exact",head:true}).eq("user_id",userId).eq("token",sub.endpoint).eq("platform","web");registered=!error&&(count??0)>0;}
      if(!cancelled)setSubscribed(registered);});return()=>{cancelled=true;};},[supported,userId]);
  const key=config.data?.publicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
  const state=getWebPushState({ios,standalone,supported,permission,subscribed,configured:!!config.data?.configured && !!key});
  const refresh=async()=>{const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(!sub||!userId){setSubscribed(false);return;}const {count}=await supabase.from("device_push_tokens").select("id",{count:"exact",head:true}).eq("user_id",userId).eq("token",sub.endpoint);setSubscribed((count??0)>0);};
  const subscribe=async()=>{
    if(!userId || !supported || !key || !config.data?.configured) throw new Error("Ожидает настройки сервера");
    setPending(true);
    try {
      const result=await Notification.requestPermission();setPermission(result);
      if(result!=="granted") return;
      const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});await navigator.serviceWorker.ready;
      const previous=await reg.pushManager.getSubscription();
      const sub=previous ?? await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyBytes(key).buffer as ArrayBuffer});
      const json=sub.toJSON();
      if(!json.keys?.p256dh || !json.keys.auth) throw new Error("Не удалось создать подписку");
      const {error}=await supabase.from("device_push_tokens").upsert({user_id:userId,organization_id:currentOrgId,platform:"web",token:sub.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,device_name:ios?"iPhone / iPad":"Браузер",updated_at:new Date().toISOString()},{onConflict:"token"});
      if(error){if(!previous)await sub.unsubscribe();throw error;}
      setSubscribed(true);await qc.invalidateQueries({queryKey:["my-devices"]});
    }finally{setPending(false);}
  };
  const unsubscribe=async()=>{
    if(!userId || !supported)return;setPending(true);
    try{const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub){const {error}=await supabase.from("device_push_tokens").delete().eq("user_id",userId).eq("token",sub.endpoint);if(error)throw error;await sub.unsubscribe();}setSubscribed(false);await qc.invalidateQueries({queryKey:["my-devices"]});}finally{setPending(false);}
  };
  const sendTest=async()=>{if(!userId || !currentOrgId)throw new Error("Выберите организацию");const {error}=await supabase.from("notifications").insert({user_id:userId,organization_id:currentOrgId,type:"push_test",title:"CRSS",message:"Тестовое уведомление на этом устройстве",link:"/me/notifications"});if(error)throw error;};
  return {state,refresh,subscribe,unsubscribe,sendTest,pending,loading:config.isLoading,configured:config.data?.configured??false};
}
