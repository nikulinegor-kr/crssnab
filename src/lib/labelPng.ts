import QRCode from 'qrcode';
import type { LabelInput } from './warehouseLabels';
import { qrLink } from './warehouseQr';
import { labelVisibleLines } from './labelPeople';
import { computeLabelLayout } from './labelLayout';
/** NIIMBOT B1 roll: strictly 50 mm wide x 80 mm tall (5:8). No other format is exported. */
export const LABEL_SIZE = {width:50,height:80} as const;
export const LABEL_PX_PER_MM = 12;
export type LabelSize = {width:number;height:number};
/** Local monochrome PNG; QR on the left (geometry unchanged), measured text block on the right. */
export async function labelPng(label:LabelInput,preview=false):Promise<Blob> {
 await document.fonts.ready;
 const size:LabelSize=LABEL_SIZE,scale=LABEL_PX_PER_MM,w=size.width*scale,h=size.height*scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');if(!c)throw Error('PNG недоступен');
 c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#000';
 const layout=computeLabelLayout({title:label.title,lines:labelVisibleLines(label.lines).filter(t=>t!==label.title),applicant:label.applicant,receiver:label.receiver},w,h,(t,f)=>{c.font=f;return c.measureText(t).width;});
 c.textBaseline='top';
 for(const b of layout.boxes){c.font=b.font;c.fillText(b.text,b.x,b.y);}
 const {x,y,size:q}=layout.qr;
 if(preview){c.strokeRect(x,y,q,q);c.font='18px Arial';c.fillText('QR после',x+12,y+q/2-8);c.fillText('приёмки',x+12,y+q/2+16);}
 else{const image=new Image();image.src=await QRCode.toDataURL(qrLink(label.kind,label.token,window.location.origin),{width:q,margin:4,errorCorrectionLevel:'M'});await image.decode();c.imageSmoothingEnabled=false;c.drawImage(image,x,y,q,q);}
 const raw=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG недоступен')),'image/png'));
 return new Blob([withPhysicalSize(new Uint8Array(await raw.arrayBuffer()),scale*1000) as Uint8Array<ArrayBuffer>],{type:'image/png'});
}

const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b:Uint8Array){let c=0xffffffff;for(const x of b)c=CRC[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
/** Insert a pHYs chunk (pixels per metre) after IHDR so apps import the PNG as exactly 50x80 mm (304.8 dpi). */
export function withPhysicalSize(png:Uint8Array,pxPerMetre:number):Uint8Array<ArrayBuffer>{
 const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);
 v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,pxPerMetre);v.setUint32(12,pxPerMetre);chunk[16]=1;
 v.setUint32(17,crc32(chunk.subarray(4,17)));
 const at=8+25,out=new Uint8Array(png.length+21);out.set(png.subarray(0,at));out.set(chunk,at);out.set(png.subarray(at),at+21);return out;
}
