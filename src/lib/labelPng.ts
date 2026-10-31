import QRCode from 'qrcode';
import type { LabelInput } from './warehouseLabels';
import { qrPayload } from './warehouseQr';
export const LABEL_SIZES = [{width:50,height:30},{width:60,height:40},{width:40,height:30}] as const;
export type LabelSize = {width:number;height:number};
/** Local monochrome print artifact; no data leaves the browser. */
export async function labelPng(label:LabelInput,size:LabelSize,preview=false):Promise<Blob> {
 await document.fonts.ready;
 const scale=12, w=size.width*scale,h=size.height*scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');if(!c)throw Error('PNG недоступен');
 c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#000';
 const pad=20,q=Math.floor(h*0.53),textWidth=w-pad*2;
 function wrap(text:string,font:number){c.font=`600 ${font}px Manrope, Arial, sans-serif`;const rows:string[]=[];let row='';for(const char of text){if(c.measureText(row+char).width>textWidth&&row){rows.push(row.trim());row='';}row+=char;}if(row)rows.push(row.trim());return rows;}
 let font=32,rows=wrap(label.title,font);while(rows.length*(font+4)>h-q-pad*2 && font>14){font-=1;rows=wrap(label.title,font);}
 if(rows.length*(font+4)>h-q-pad*2)throw Error('Название слишком длинное для выбранного размера. Выберите большую этикетку.');
 c.font=`600 ${font}px Manrope, Arial, sans-serif`;rows.forEach((row,i)=>c.fillText(row,pad,pad+font+i*(font+4)));
 const y=h-q-pad;
 if(preview){c.strokeRect(pad,y,q,q);c.font='18px Arial';c.fillText('QR после',pad+12,y+q/2-8);c.fillText('приёмки',pad+12,y+q/2+16);}
 else {const image=new Image();const payload=qrPayload(label.kind,label.token);image.src=await QRCode.toDataURL(label.kind==='request'?new URL(payload,window.location.origin).href:payload,{width:q,margin:4,errorCorrectionLevel:'M'});await image.decode();c.imageSmoothingEnabled=false;c.drawImage(image,pad,y,q,q);}
 c.font='18px Manrope, Arial, sans-serif';const meta=[...label.lines,...(preview?[]:[`ID: ${label.token.slice(-8)}`])].filter(Boolean);
 let my=y+22;for(const text of meta){let row='';for(const char of text){if(c.measureText(row+char).width>w-q-pad*3&&row){c.fillText(row,q+pad*2,my);my+=22;row='';}row+=char;}c.fillText(row,q+pad*2,my);my+=22;}
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG недоступен')),'image/png'));
}
