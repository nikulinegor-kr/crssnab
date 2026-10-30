import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { callClaude } from "../_shared/claude.ts";
import { extractAttachedInvoice } from "../_shared/invoiceExtract.ts";
import { bearerToken, checkAssistantLimit, ASSISTANT_SYSTEM, assistantTools, executeRequestTool, sanitizeProposal } from "../_shared/requestAssistant.ts";
const schema=z.object({request_id:z.string().uuid(),action:z.enum(["summary","supplier_letter","next_step","chat","parse_invoice"]),file_path:z.string().min(1).max(2000).optional(),force:z.boolean().optional(),conversation_id:z.string().uuid().optional(),messages:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(10000)})).max(30).optional(),letter_type:z.enum(["quote","shipment","invoice"]).optional(),supplier_id:z.string().uuid().optional()});
Deno.serve(async req=>{
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Метод не поддерживается"},405);
 let token:string;try{token=bearerToken(req.headers.get("Authorization"));}catch{return json({error:"Для работы Claude войдите в CRSS."},401);}
 const db=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:claims,error:authError}=await db.auth.getClaims(token);
 if(authError||!claims?.claims?.sub)return json({error:"Сессия истекла. Войдите снова."},401);
 const userId=claims.claims.sub;
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return json({error:"Проверьте заявку и текст вопроса."},400);
 try{
  const input=parsed.data;
  const {data:request,error:requestError}=await db.from("requests").select("*").eq("id",input.request_id).maybeSingle();
  if(requestError||!request)return json({error:"Заявка не найдена или нет доступа."},404);
  if(input.action==="parse_invoice") {
   const {data:allowed,error:permissionError}=await db.rpc("can_use_trust_letters",{_user:userId,_org:request.organization_id});
   if(permissionError||!allowed)return json({error:"Нет права на доверительные письма."},403);
   if(!input.file_path)return json({error:"Выберите прикреплённый счёт."},400);
   if(!input.force){const {data:cached,error}=await db.from("request_invoice_extracts").select("extracted").eq("request_id",request.id).eq("file_path",input.file_path).maybeSingle();if(error)throw error;if(cached)return json({extracted:cached.extracted,cached:true,usage:null});}
  }
  const {count,error:countError}=await db.from("ai_messages").select("id,ai_conversations!inner(user_id)",{count:"exact",head:true}).eq("ai_conversations.user_id",userId).eq("role","user").gte("created_at",new Date(Date.now()-3600000).toISOString());
  if(countError)throw new Error("Не удалось проверить лимит Claude.");
  try{checkAssistantLimit(count??0);}catch(e){return json({error:(e as Error).message},429);}
  const apiKey=Deno.env.get("ANTHROPIC_API_KEY");if(!apiKey)return json({error:"Claude ожидает настройки ключа."},503);
  const title=`Заявка ${request.request_number}`;
  let conversationId=input.conversation_id;
  if(conversationId){const {data,error}=await db.from("ai_conversations").select("id").eq("id",conversationId).eq("user_id",userId).eq("organization_id",request.organization_id).eq("title",title).maybeSingle();if(error||!data)return json({error:"Диалог не принадлежит этой заявке."},403);}
  else {const {data,error}=await db.from("ai_conversations").insert({user_id:userId,organization_id:request.organization_id,title}).select("id").single();if(error||!data)throw new Error("Не удалось сохранить диалог.");conversationId=data.id;}
  const prompts={summary:"Сводка заявки в 3–5 строках.",supplier_letter:`Черновик письма: ${input.letter_type==="shipment"?"уточнение сроков отгрузки":input.letter_type==="invoice"?"запрос счёта":"запрос КП"}.`,next_step:"Что дальше? Предложи следующий шаг и задачу при необходимости.",chat:input.messages?.filter(m=>m.role==="user").at(-1)?.content??"",parse_invoice:"Распознать прикреплённый счёт"};
  const question=prompts[input.action];if(!question.trim())return json({error:"Введите вопрос."},400);
  const {data:history,error:historyError}=await db.from("ai_messages").select("role,content").eq("conversation_id",conversationId).order("created_at",{ascending:false}).limit(20);if(historyError)throw new Error("Не удалось прочитать диалог.");
  const {error:logError}=await db.from("ai_messages").insert({conversation_id:conversationId,role:"user",content:question});if(logError)throw new Error("Не удалось сохранить вопрос.");
  if(input.action==="parse_invoice"&&input.file_path){const result=await extractAttachedInvoice(db,request,userId,input.file_path,Boolean(input.force),apiKey,callClaude);const {error}=await db.from("ai_messages").insert({conversation_id:conversationId,role:"assistant",content:JSON.stringify({text:"Счёт распознан",usage:result.usage,proposals:[]})});if(error)throw error;return json(result);}
  const [{data:profile},{data:members},{data:supplier}]=await Promise.all([db.from("profiles").select("full_name,position").eq("id",userId).maybeSingle(),db.from("user_organizations").select("user_id,is_active,planner_access,role").eq("organization_id",request.organization_id).eq("is_active",true).limit(1000),input.supplier_id?db.from("suppliers").select("id,name,inn,kpp,address,email,phone,contact_person").eq("id",input.supplier_id).eq("organization_id",request.organization_id).maybeSingle():Promise.resolve({data:null})]);
  const assignable=(members??[]).filter(m=>m.planner_access||["owner","admin"].includes(m.role));
  const {data:names}=await db.from("profiles").select("id,full_name,position").in("id",assignable.map(m=>m.user_id));
  const context=await executeRequestTool(db,"get_request",{id:request.id},request);
  const messages:any[]=(history??[]).reverse().map(m=>{let content=m.content;try{content=JSON.parse(content).text??content;}catch{}return {role:m.role,content};});
  messages.push({role:"user",content:question});
  const system=ASSISTANT_SYSTEM+`\nСегодня ${new Date().toISOString()}. Текущая заявка ${request.id}. Данные get_request: ${JSON.stringify(context)}. Профиль: ${JSON.stringify(profile)}. Сотрудники: ${JSON.stringify(names)}. Выбранный поставщик: ${JSON.stringify(supplier)}.`;
  const proposals:any[]=[];const usage={input_tokens:0,output_tokens:0};let text="";
  for(let round=0;round<6;round++){
   const response=await callClaude(apiKey,{system,tools:assistantTools,messages});usage.input_tokens+=response.usage?.input_tokens??0;usage.output_tokens+=response.usage?.output_tokens??0;
   messages.push({role:"assistant",content:response.content});
   const calls=response.content.filter((b:any)=>b.type==="tool_use");
   if(!calls.length){text=response.content.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");break;}
   const results=[];
   for(const call of calls){try{let data;if(call.name==="propose_task"){const proposal=sanitizeProposal(call.input,assignable.map(m=>m.user_id));if(proposal)proposals.push(proposal);data={proposed:Boolean(proposal),created:false};}else data=await executeRequestTool(db,call.name,call.input,request);results.push({type:"tool_result",tool_use_id:call.id,content:JSON.stringify(data)});}catch{results.push({type:"tool_result",tool_use_id:call.id,is_error:true,content:"Данные недоступны или инструмент запрещён"});}}
   messages.push({role:"user",content:results});
  }
  if(!text)throw new Error("Claude не завершил ответ. Уточните вопрос.");
  const result={text,proposals:proposals.slice(0,3),usage,conversation_id:conversationId};
  const {error}=await db.from("ai_messages").insert({conversation_id:conversationId,role:"assistant",content:JSON.stringify(result)});if(error)throw new Error("Ответ получен, но не удалось сохранить диалог.");
  return json(result);
 }catch(e){return json({error:e instanceof Error?e.message:"Не удалось получить ответ Claude."},502);}
});
