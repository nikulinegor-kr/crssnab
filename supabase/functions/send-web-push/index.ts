import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { z } from "npm:zod@3.23.8";
import { deliverWebPush, isAllowedPushEndpoint } from "../_shared/webPushDelivery.ts";
import { VAPID_PUBLIC_KEY } from "../_shared/webPushConfig.ts";
const bodySchema = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(100), title: z.string().max(200).default("CRSS"), body: z.string().max(800).default(""), route: z.string().max(2048).nullable().optional(), notification_id: z.string().uuid() });
Deno.serve(async req => {
  const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type":"application/json" } });
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  const url=Deno.env.get("SUPABASE_URL"); const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({error:"server_not_configured"},503);
  const admin=createClient(url,service);
  if (req.method === "GET" && new URL(req.url).searchParams.get("config") === "1") {
    const bearer=req.headers.get("authorization")?.replace(/^Bearer /,"");
    if (!bearer || (await admin.auth.getUser(bearer)).error) return json({error:"unauthorized"},401);
    const publicKey=VAPID_PUBLIC_KEY;
    return json({configured:Boolean(publicKey && Deno.env.get("VAPID_PRIVATE_KEY") && Deno.env.get("VAPID_SUBJECT")), publicKey});
  }
  if (req.method !== "POST") return json({error:"method_not_allowed"},405);
  const hook=req.headers.get("x-apns-hook");
  let authorized=req.headers.get("authorization") === `Bearer ${service}`;
  if (!authorized && hook) { const {data,error}=await admin.rpc("verify_push_hook_secret",{candidate:hook}); authorized=!error && data===true; }
  if (!authorized) return json({error:"unauthorized"},401);
  const parsed=bodySchema.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return json({error:"invalid_payload"},400);
  const publicKey=VAPID_PUBLIC_KEY;const privateKey=Deno.env.get("VAPID_PRIVATE_KEY");const subject=Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return json({error:"web_push_not_configured"},503);
  try {
    webpush.setVapidDetails(subject,publicKey,privateKey);
    const body=parsed.data;
    const {data:devices,error}=await admin.from("device_push_tokens").select("id,token,p256dh,auth,fail_count").in("user_id",body.user_ids).eq("platform","web");
    if(error) return json({error:"device_lookup_failed"},500);
    const route=body.route?.startsWith("/") && !body.route.startsWith("//") ? body.route : "/me";
    const payload=JSON.stringify({title:body.title,body:body.body,url:route,tag:body.notification_id,icon:"/icons/icon-192.png",badge:"/icons/icon-192.png"});
    const results=[];
    for (const device of devices ?? []) {
      if(!device.p256dh || !device.auth || !isAllowedPushEndpoint(device.token)) { await admin.from("device_push_tokens").update({fail_count:device.fail_count+1}).eq("id",device.id);results.push("failed");continue; }
      results.push(await deliverWebPush(device,()=>webpush.sendNotification({endpoint:device.token,keys:{p256dh:device.p256dh,auth:device.auth}},payload,{TTL:86400,timeout:10000}),{
        remove:async id=>{const {error}=await admin.from("device_push_tokens").delete().eq("id",id);if(error)throw error;},
        update:async(id,patch)=>{const {error}=await admin.from("device_push_tokens").update(patch).eq("id",id);if(error)throw error;},
      }));
    }
    return json({sent:results.filter(r=>r==="sent").length,removed:results.filter(r=>r==="removed").length,failed:results.filter(r=>r==="failed").length});
  } catch { return json({error:"web_push_send_failed"},500); }
});
