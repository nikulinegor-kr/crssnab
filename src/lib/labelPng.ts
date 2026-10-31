import QRCode from 'qrcode';
import type { LabelInput } from './warehouseLabels';
import { qrLink } from './warehouseQr';
import { labelVisibleLines } from './labelPeople';
import { computeLabelLayout } from './labelLayout';
export const LABEL_SIZES = [{width:50,height:30},{width:60,height:40},{width:40,height:30}] as const;
export type LabelSize = {width:number;height:number};
/** Local monochrome PNG; QR on the left (geometry unchanged), measured text block on the right. */
export async function labelPng(label:LabelInput,size:LabelSize,preview=false):Promise<Blob> {
 await document.fonts.ready;
 const scale=12,w=size.width*scale,h=size.height*scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');if(!c)throw Error('PNG недоступен');
 c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#000';
 const layout=computeLabelLayout({title:label.title,lines:labelVisibleLines(label.lines).filter(t=>t!==label.title),applicant:label.applicant,receiver:label.receiver},w,h,(t,f)=>{c.font=f;return c.measureText(t).width;});
 c.textBaseline='top';
 for(const b of layout.boxes){c.font=b.font;c.fillText(b.text,b.x,b.y);}
 const {x,y,size:q}=layout.qr;
 if(preview){c.strokeRect(x,y,q,q);c.font='18px Arial';c.fillText('QR после',x+12,y+q/2-8);c.fillText('приёмки',x+12,y+q/2+16);}
 else{const image=new Image();image.src=await QRCode.toDataURL(qrLink(label.kind,label.token,window.location.origin),{width:q,margin:4,errorCorrectionLevel:'M'});await image.decode();c.imageSmoothingEnabled=false;c.drawImage(image,x,y,q,q);}
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG недоступен')),'image/png'));
}
