import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
export const LETTER_TAGS=["addressee_position","addressee_orgs","addressee_name","suppliers_list","groups","supplier","items","name","qty","unit","invoice_number","invoice_date","amount","carrier","destination"];
export type InvoiceExtract={supplier_name:string|null;supplier_inn:string|null;invoice_number:string|null;invoice_date:string|null;total_amount:number|null;director_position:string|null;director_name:string|null;director_name_dative:string|null;items:{name:string|null;qty:number|null;unit:string|null}[]};
export type LetterGroup={supplier:string;items:{name:string;qty:number|string;unit:string}[];invoice_number:string;invoice_date:string;amount:string};
export type LetterPayload={addressee_position:string;addressee_orgs:string;addressee_name:string;suppliers_list:string;groups:LetterGroup[];carrier:string;destination:string};
export type LetterSource={requestId:string;requestNumber:string;carrier:string;extracted:InvoiceExtract;fromInvoice:boolean};
export type LetterDraft={key:string;requestIds:string[];payload:LetterPayload};
export function carrierName(value:string|null|undefined){const text=value?.trim()??"";return text?/^ТК/i.test(text)?text:`ТК ${text}`:"";}
export function letterAmount(n:number|null){return n===null?"":new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n).replace(/\u00a0|\u202f/g," ");}
export function letterDate(date:string|null){if(!date)return "";const m=date.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:date;}
const normalized=(v:string|null)=>v?.trim().toLocaleLowerCase("ru").replace(/\s+/g," ")??"";
export function groupTrustLetters(sources:LetterSource[],destination="терминала г. Нерюнгри"):LetterDraft[]{
 const letters=new Map<string,LetterDraft>();
 for(const source of sources){const carrier=carrierName(source.carrier);if(!carrier)throw new Error(`Выберите ТК в заявке ${source.requestNumber}`);const x=source.extracted;
  // Missing directors must never merge distinct suppliers on an invented identity.
  const director=normalized(x.director_name)||normalized(x.director_name_dative)||`unknown:${x.supplier_inn||normalized(x.supplier_name)||source.requestId}`;
  const key=JSON.stringify([normalized(carrier),director]);let draft=letters.get(key);
  if(!draft){draft={key,requestIds:[],payload:{addressee_position:x.director_position??"",addressee_orgs:"",addressee_name:x.director_name_dative??"",suppliers_list:"",groups:[],carrier,destination}};letters.set(key,draft);}
  draft.requestIds.push(source.requestId);const group:LetterGroup={supplier:x.supplier_name??"",invoice_number:x.invoice_number??"",invoice_date:letterDate(x.invoice_date),amount:letterAmount(x.total_amount),items:x.items.map(i=>({name:i.name??"",qty:i.qty??"",unit:i.unit??""}))};
  const existing=draft.payload.groups.find(g=>normalized(g.supplier)===normalized(group.supplier)&&g.invoice_number&&g.invoice_number===group.invoice_number&&g.invoice_date===group.invoice_date);
  if(!existing)draft.payload.groups.push(group);
  const suppliers=[...new Set(draft.payload.groups.map(g=>g.supplier).filter(Boolean))];draft.payload.addressee_orgs=suppliers.join(" и ");draft.payload.suppliers_list=suppliers.join(", ");
 }
 return [...letters.values()].map(d=>({...d,requestIds:[...new Set(d.requestIds)]}));
}
export function invoiceWarnings(request:{invoice_number?:string|null;amount?:number|null;contractor?:string|null;status?:string},x:InvoiceExtract,now=Date.now()){
 const warnings:string[]=[];
 if(request.invoice_number&&x.invoice_number&&request.invoice_number.trim()!==x.invoice_number.trim())warnings.push("Номер счёта расходится с заявкой");
 if(request.amount!=null&&x.total_amount!=null&&Math.abs(Number(request.amount)-x.total_amount)>0.01)warnings.push("Сумма счёта расходится с заявкой");
 if(request.contractor&&x.supplier_name&&normalized(request.contractor)!==normalized(x.supplier_name))warnings.push("Поставщик в счёте не совпадает с контрагентом заявки");
 if(x.invoice_date&&now-Date.parse(x.invoice_date)>30*86400000)warnings.push("Счёт старше 30 дней");
 if(request.status==="Доставлено")warnings.push("Заявка уже «Доставлено»");return warnings;
}
export function validateLetterPayload(p:LetterPayload){if(!p.carrier.trim()||!p.destination.trim()||!p.addressee_name.trim()||!p.addressee_position.trim()||!p.addressee_orgs.trim()||!p.suppliers_list.trim())throw new Error("Заполните адресата, поставщиков и пункт назначения");if(!p.groups.length||p.groups.some(g=>!g.supplier.trim()||!g.invoice_number.trim()||!/^\d{2}\.\d{2}\.\d{4}$/.test(g.invoice_date)||!g.amount.trim()||!g.items.length||g.items.some(i=>!i.name.trim()||!i.unit.trim()||!Number.isFinite(Number(i.qty))||Number(i.qty)<=0)))throw new Error("Заполните поставщика, счёт, сумму и все позиции");}
export const DEMO_LETTER:LetterPayload={addressee_position:"Генеральному директору",addressee_orgs:"ООО «КДК-Инжиниринг» и ООО «Комплекс дорожных конструкций»",addressee_name:"Клыпе В.А.",suppliers_list:"ООО «КДК-Инжиниринг», ООО «Комплекс дорожных конструкций»",groups:[{supplier:"ООО «КДК-Инжиниринг»",invoice_number:"160",invoice_date:"22.10.2026",amount:"10 400,00",items:[{name:"Позиция для проверки бланка",qty:1,unit:"шт."}]},{supplier:"ООО «Комплекс дорожных конструкций»",invoice_number:"413",invoice_date:"05.10.2026",amount:"122 935,00",items:[{name:"Первая позиция для проверки",qty:1,unit:"шт."},{name:"Вторая позиция для проверки",qty:2,unit:"шт."}]}],carrier:"ТК СЛТК",destination:"терминала г. Нерюнгри"};
export function validateLetterTemplate(buffer:ArrayBuffer){
 const zip=new PizZip(buffer);const xml=Object.keys(zip.files).filter(n=>/^word\/.*\.xml$/.test(n)).map(n=>zip.file(n)?.asText()??"").join("\n").replace(/<[^>]*>/g,"");
 const tags=[...xml.matchAll(/\{([#/]?)([^{}]+)\}/g)].map(m=>m[2].trim());const missing=LETTER_TAGS.filter(t=>!tags.includes(t));if(missing.length)throw new Error(`В бланке нет полей: ${missing.join(", ")}`);
 const extra=tags.filter(t=>!LETTER_TAGS.includes(t));if(extra.length)throw new Error(`Неизвестные поля бланка: ${[...new Set(extra)].join(", ")}`);
 const doc=new Docxtemplater(zip,{paragraphLoop:true,linebreaks:true});doc.render(DEMO_LETTER);
}
export function renderTrustLetter(buffer:ArrayBuffer,payload:LetterPayload){validateLetterPayload(payload);validateLetterTemplate(buffer);const doc=new Docxtemplater(new PizZip(buffer),{paragraphLoop:true,linebreaks:true});doc.render(payload);return doc.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});}
export function downloadLetter(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}