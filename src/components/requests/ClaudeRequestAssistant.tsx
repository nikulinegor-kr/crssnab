import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Copy, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ContractorSelect } from "@/components/ContractorSelect";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { useCreatePlannerTask } from "@/hooks/usePlannerTasks";
import { usePlannerMembers } from "@/hooks/useOrgMembers";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { confirmedProposalInput, type TaskProposal, type AssistantReply } from "@/lib/claudeRequestAssistant";
import { TrustLetterButton } from "./TrustLetterDialog";

export function ClaudeTaskProposal({ proposal, requestId, onEdit }: { proposal: TaskProposal; requestId: string; onEdit: (p: TaskProposal) => void }) {
 const create=useCreatePlannerTask();const {data:members=[]}=usePlannerMembers();const [created,setCreated]=useState(false);
 const name=members.find(m=>m.user_id===proposal.assignee_id)?.full_name ?? "не назначен";
 return <div className="rounded-md border border-border p-3"><p className="break-words text-sm font-medium">Создать задачу: {proposal.title}</p><p className="mt-1 text-xs text-muted-foreground">{name} · срок {proposal.due_date??"не указан"}</p><div className="mt-2 flex gap-2"><Button className="min-h-11" disabled={created||create.isPending} onClick={async()=>{const input=confirmedProposalInput(proposal,requestId,true);if(!input)return;try{await create.mutateAsync(input);setCreated(true);}catch{toast.error("Не удалось создать задачу");}}}>{created?"Создана":"Создать"}</Button><Button variant="outline" className="min-h-11" disabled={created} onClick={()=>onEdit(proposal)}>Изменить</Button></div></div>;
}
function parseReply(content: string): Partial<AssistantReply> {
 try {const parsed=JSON.parse(content);if(typeof parsed.text==="string")return parsed;}catch{}
 return {text:content,proposals:[]};
}
export function ClaudeRequestAssistant({requestId,requestNumber,organizationId,onBack}: {requestId:string;requestNumber:string;organizationId:string;onBack:()=>void}) {
 const qc=useQueryClient();const [question,setQuestion]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const [letter,setLetter]=useState(false);const [letterType,setLetterType]=useState("quote");const [supplier,setSupplier]=useState("");const [editing,setEditing]=useState<TaskProposal|null>(null);
 const history=useQuery({queryKey:["claude-request-history",requestId],queryFn:async()=>{
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Войдите в CRSS");
  const {data:conversation,error}=await supabase.from("ai_conversations").select("id").eq("organization_id",organizationId).eq("user_id",user.id).eq("title",`Заявка ${requestNumber}`).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;
  if(!conversation)return {conversationId:undefined,messages:[]};
  const {data,error:messageError}=await supabase.from("ai_messages").select("id,role,content").eq("conversation_id",conversation.id).order("created_at",{ascending:false}).limit(50);if(messageError)throw messageError;
  return {conversationId:conversation.id,messages:(data??[]).reverse()};
 }});
 const suppliers=useQuery({queryKey:["claude-suppliers",organizationId],enabled:letter,queryFn:async()=>{const all:{id:string;name:string}[]=[];for(let start=0;;start+=1000){const{data,error}=await supabase.from("suppliers").select("id,name").eq("organization_id",organizationId).order("name").range(start,start+999);if(error)throw error;all.push(...data);if(data.length<1000)return all;}}});
 const send=async(action:"summary"|"supplier_letter"|"next_step"|"chat")=>{
  if(pending||history.isLoading)return;setPending(true);setError("");
  try{const selected=suppliers.data?.find(s=>s.name===supplier);const {data,error}=await supabase.functions.invoke("claude-request-assistant",{body:{request_id:requestId,action,conversation_id:history.data?.conversationId,messages:action==="chat"?[{role:"user",content:question}]:undefined,letter_type:letterType,supplier_id:selected?.id}});if(error)throw new Error(await getFunctionErrorMessage(error,"Claude недоступен"));if(!data?.text)throw new Error("Claude не вернул ответ");setQuestion("");}
  catch(e){setError(e instanceof Error?e.message:"Не удалось получить ответ");}
  finally{await qc.invalidateQueries({queryKey:["claude-request-history",requestId]});setPending(false);}
 };
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success("Скопировано");}catch{toast.error("Не удалось скопировать");}};
 return <div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
 <div className="shrink-0 px-3 pt-3"><TrustLetterButton requestIds={[requestId]} organizationId={organizationId}/></div>
 <div className="shrink-0 border-b border-border p-3"><Button variant="ghost" className="min-h-11 px-0" onClick={onBack}><ArrowLeft/>Назад к заявке</Button><h3 className="text-base font-semibold">Claude</h3><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={pending} onClick={()=>void send("summary")}>Сводка</Button><Button variant="outline" className="min-h-11" disabled={pending} onClick={()=>setLetter(v=>!v)}>Письмо поставщику</Button><Button variant="outline" className="min-h-11" disabled={pending} onClick={()=>void send("next_step")}>Что дальше</Button></div>
 {letter&&<div className="mt-3 space-y-2"><Select value={letterType} onValueChange={setLetterType}><SelectTrigger className="min-h-11"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="quote">Запрос КП</SelectItem><SelectItem value="shipment">Уточнить отгрузку</SelectItem><SelectItem value="invoice">Запрос счёта</SelectItem></SelectContent></Select><ContractorSelect value={supplier} onChange={setSupplier} options={(suppliers.data??[]).map(s=>({value:s.id,label:s.name}))} placeholder="Поставщик (необязательно)"/><Button className="min-h-11" disabled={pending||suppliers.isLoading} onClick={()=>void send("supplier_letter")}>Подготовить письмо</Button></div>}</div>
 <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3" aria-live="polite">{history.isError&&<p role="alert" className="text-sm text-destructive">Не удалось загрузить историю</p>}{history.data?.messages.map(m=>{const reply=parseReply(m.content);return <div key={m.id} className="min-w-0 border-b border-border pb-3"><p className="mb-1 text-xs text-muted-foreground">{m.role==="user"?"Вы":"Claude"}</p><div className="prose prose-sm max-w-none break-words text-foreground [&_*]:text-inherit"><ReactMarkdown>{reply.text??""}</ReactMarkdown></div>{m.role==="assistant"&&<><Button variant="ghost" className="min-h-11" onClick={()=>void copy(reply.text??"")}><Copy/>Копировать</Button><div className="space-y-2">{reply.proposals?.map((p,i)=><ClaudeTaskProposal key={i} proposal={p} requestId={requestId} onEdit={setEditing}/>)}</div></>}</div>;})}{pending&&<p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Claude думает…</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div>
 <form className="shrink-0 border-t border-border bg-card p-3 pb-[max(12px,env(safe-area-inset-bottom))]" onSubmit={e=>{e.preventDefault();void send("chat");}}><div className="flex items-end gap-2"><Textarea aria-label="Вопрос Claude" placeholder="Вопрос по этой заявке" value={question} onChange={e=>setQuestion(e.target.value)} rows={2} className="min-h-11 min-w-0 resize-none"/><Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={pending||!question.trim()} aria-label="Отправить вопрос"><Send/></Button></div><p className="mt-2 text-xs text-muted-foreground">Ответы Claude проверяйте — он видит только данные этой заявки</p></form>
 {editing&&<PlannerTaskDialog open onOpenChange={open=>{if(!open)setEditing(null);}} defaultRequestId={requestId} defaultTitle={editing.title} defaultDescription={editing.description} defaultPriority={editing.priority} defaultAssigneeId={editing.assignee_id} defaultDueDate={editing.due_date??undefined}/>}</div>;
}
