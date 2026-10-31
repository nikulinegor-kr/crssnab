import QRCode from 'qrcode';
import type { LabelInput } from './warehouseLabels';
import { qrLink } from './warehouseQr';
export const LABEL_SIZES = [{width:50,height:30},{width:60,height:40},{width:40,height:30}] as const;
export type LabelSize = {width:number;height:number};
/** Local monochrome print artifact; no data leaves the browser. QR large on the left, all data on the right. */
export async function labelPng(label:LabelInput,size:LabelSize,preview=false):Promise<Blob> {
 await document.fonts.ready;
 const scale=12,w=size.width*scale,h=size.height*scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');if(!c)throw Error('PNG недоступен');
 c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#000';
 const pad=20,gap=18,metaFont=18,metaLine=24;
 const q=Math.min(h-pad*2,Math.floor(w*0.5)),textX=pad+q+gap,textWidth=w-pad-textX;
 if(textWidth<60)throw Error('Этикетка слишком узкая для выбранного размера. Выберите большую этикетку.');
 function wrap(text:string,font:string,maxWidth:number){c.font=font;const rows:string[]=[];let row='';for(const char of text){if(c.measureText(row+char).width>maxWidth&&row){rows.push(row.trim());row='';}row+=char;}if(row)rows.push(row.trim());return rows;}
 const meta=[...label.lines,...(preview?[]:[`ID: ${label.token.slice(-8)}`])].filter(text=>text&&text!==label.title);
 const metaSpec=`${metaFont}px Manrope, Arial, sans-serif`;
 const metaRows=meta.flatMap(text=>wrap(text,metaSpec,textWidth));
 const titleSpace=h-pad*2-metaRows.length*metaLine-(metaRows.length?14:0);
 let font=30,rows=wrap(label.title,`600 ${font}px Manrope, Arial, sans-serif`,textWidth);
 while(rows.length*(font+4)>titleSpace&&font>12){font--;rows=wrap(label.title,`600 ${font}px Manrope, Arial, sans-serif`,textWidth);}
 if(rows.length*(font+4)>titleSpace)throw Error('Название слишком длинное для выбранного размера. Выберите большую этикетку.');
 c.font=`600 ${font}px Manrope, Arial, sans-serif`;
 rows.forEach((row,i)=>c.fillText(row,textX,pad+font+i*(font+4)));
 c.font=metaSpec;let my=pad+rows.length*(font+4)+18;
 for(const row of metaRows){c.fillText(row,textX,my);my+=metaLine;}
 const y=pad;
 if(preview){c.strokeRect(pad,y,q,q);c.font='18px Arial';c.fillText('QR после',pad+12,y+q/2-8);c.fillText('приёмки',pad+12,y+q/2+16);}
 else{const image=new Image();image.src=await QRCode.toDataURL(qrLink(label.kind,label.token,window.location.origin),{width:q,margin:4,errorCorrectionLevel:'M'});await image.decode();c.imageSmoothingEnabled=false;c.drawImage(image,pad,y,q,q);}
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG недоступен')),'image/png'));
}
