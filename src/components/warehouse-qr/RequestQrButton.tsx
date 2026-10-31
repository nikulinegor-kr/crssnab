import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LabelExporter } from './LabelExporter';
export function RequestQrButton({request}:{request:{id:string;description:string;request_number:string}}){
 const [open,setOpen]=useState(false);
 return <><Button variant="outline" className="min-h-11" onClick={()=>setOpen(true)}><QrCode className="h-4 w-4 mr-2"/>QR заявки</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle className="break-words">{request.description||'Заявка'}</DialogTitle></DialogHeader><LabelExporter labels={[{kind:'request',token:request.id,title:request.description||'Заявка',lines:[request.request_number]}]}/></DialogContent></Dialog></>;
}