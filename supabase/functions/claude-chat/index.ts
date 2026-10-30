import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { callClaude } from "../_shared/claude.ts";
Deno.serve(async req=>{
 const json=(error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 const header=req.headers.get("Authorization");if(!header?.startsWith("Bearer "))return json("Войдите в CRSS",401);
 const db=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:header}}});
 const {data,error}=await db.auth.getClaims(header.slice(7));if(error||!data?.claims)return json("Войдите в CRSS",401);
 const parsed=z.object({messages:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(10000)})).min(1).max(30)}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return json("Проверьте вопрос",400);
 const key=Deno.env.get("ANTHROPIC_API_KEY");if(!key)return json("Claude ожидает настройки",503);
 try{const reply=await callClaude(key,{system:"Отвечай кратко по-русски. Данные CRM не предоставлены: не выдумывай факты, цены, сроки, поставщиков. Для заявки используйте помощника в её карточке.",messages:parsed.data.messages});const text=reply.content.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");return new Response(`data: ${JSON.stringify({choices:[{delta:{content:text},index:0}]})}\n\ndata: [DONE]\n\n`,{headers:{...corsHeaders,"Content-Type":"text/event-stream"}});}catch(e){return json(e instanceof Error?e.message:"Claude недоступен",502);}
});
