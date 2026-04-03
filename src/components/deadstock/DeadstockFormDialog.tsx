import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { useIsMobile } from "@/hooks/use-mobile";
import { DeadstockItem, uploadDeadstockFiles, getDeadstockSignedUrl } from "@/hooks/useDeadstock";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: DeadstockItem | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  isPending: boolean;
  profiles: Profile[];
}

export function DeadstockFormDialog({ open, onOpenChange, item, onSave, isPending, profiles }: Props) {
  const isMobile = useIsMobile();
  const { currentOrgId } = useCurrentOrganization();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [partNumber, setPartNumber] = useState("");
  const [price, setPrice] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState<string>("");
  const [soldAt, setSoldAt] = useState("");
  const [buyer, setBuyer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tk, setTk] = useState("");
  const [shippedAt, setShippedAt] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (item) {
        setName(item.name);
        setDescription(item.description || "");
        setQty(String(item.qty));
        setPartNumber(item.part_number || "");
        setPrice(String(item.price));
        setResponsibleUserId(item.responsible_user_id || "");
        setSoldAt(item.sold_at || "");
        setBuyer(item.buyer || "");
        setInvoiceNumber(item.invoice_number || "");
        setTk(item.tk || "");
        setShippedAt(item.shipped_at || "");
        setArrivedAt(item.arrived_at || "");
        // Resolve signed URLs for existing photos/docs (buckets are now private)
        const resolveUrls = async (urls: string[], bucket: "deadstock-photos" | "deadstock-documents") => {
          return Promise.all(urls.map(url => getDeadstockSignedUrl(url, bucket)));
        };
        resolveUrls(item.photo_urls || [], "deadstock-photos").then(setExistingPhotos);
        resolveUrls(item.document_urls || [], "deadstock-documents").then(setExistingDocs);
      } else {
        setName(""); setDescription(""); setQty("1"); setPartNumber(""); setPrice("");
        setSoldAt(""); setBuyer(""); setInvoiceNumber(""); setTk("");
        setShippedAt(""); setArrivedAt("");
        setExistingPhotos([]); setExistingDocs([]);
        // Default to current user
        supabase.auth.getUser().then(({ data }) => {
          setResponsibleUserId(data.user?.id || "");
        });
      }
      setPhotoFiles([]); setDocFiles([]);
    }
  }, [open, item]);

  const canSubmit = name.trim() && Number(qty) > 0 && Number(price) > 0;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit || !currentOrgId) return;
    setUploading(true);
    try {
      let photoUrls = [...existingPhotos];
      let docUrls = [...existingDocs];
      if (photoFiles.length > 0) {
        const newPhotos = await uploadDeadstockFiles(photoFiles, "deadstock-photos", currentOrgId);
        photoUrls = [...photoUrls, ...newPhotos];
      }
      if (docFiles.length > 0) {
        const newDocs = await uploadDeadstockFiles(docFiles, "deadstock-documents", currentOrgId);
        docUrls = [...docUrls, ...newDocs];
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        qty: Number(qty),
        part_number: partNumber.trim() || null,
        price: Number(price),
        responsible_user_id: responsibleUserId || null,
        sold_at: soldAt || null,
        buyer: buyer.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        tk: tk.trim() || null,
        shipped_at: shippedAt || null,
        arrived_at: arrivedAt || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        document_urls: docUrls.length > 0 ? docUrls : null,
        organization_id: currentOrgId,
      };
      if (item) payload.id = item.id;
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const formContent = (
    <form id="deadstock-form" onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Наименование *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Наименование позиции" />
      </div>
      <div>
        <Label>Описание</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Кол-во *</Label>
          <Input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div>
          <Label>Цена *</Label>
          <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Парт номер</Label>
        <Input value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="Парт номер" />
      </div>
      <div>
        <Label>Ответственный</Label>
        <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите ответственного" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {item?.status === "archived" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Дата продажи</Label>
              <Input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} className="min-w-0" />
            </div>
            <div>
              <Label>Номер счета</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Покупатель</Label>
            <Input value={buyer} onChange={e => setBuyer(e.target.value)} />
          </div>
          <div>
            <Label>ТК</Label>
            <Input value={tk} onChange={e => setTk(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Дата отгрузки</Label>
              <Input type="date" value={shippedAt} onChange={e => setShippedAt(e.target.value)} className="min-w-0" />
            </div>
            <div>
              <Label>Дата прихода</Label>
              <Input type="date" value={arrivedAt} onChange={e => setArrivedAt(e.target.value)} className="min-w-0" />
            </div>
          </div>
        </>
      )}

      <MultiFileDropZone
        accept="image/*"
        files={photoFiles}
        onFilesChange={setPhotoFiles}
        existingUrls={existingPhotos}
        onRemoveExisting={url => setExistingPhotos(prev => prev.filter(u => u !== url))}
        label="Фото"
        hint="До 15 фото, макс. 10 МБ каждое"
        icon="image"
        maxFiles={15}
      />
      <MultiFileDropZone
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        files={docFiles}
        onFilesChange={setDocFiles}
        existingUrls={existingDocs}
        onRemoveExisting={url => setExistingDocs(prev => prev.filter(u => u !== url))}
        label="Документы"
        hint="PDF, Word, Excel — макс. 10 МБ"
        icon="document"
        maxFiles={5}
      />
    </form>
  );

  const actions = (
    <div className="flex gap-2 w-full">
      <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Отмена</Button>
      <Button type="submit" form="deadstock-form" className="flex-1" disabled={!canSubmit || isPending || uploading}>
        {isPending || uploading ? "Сохранение..." : item ? "Сохранить" : "Создать"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={false}>
        <DrawerContent className="mt-0 h-[90dvh] max-h-[90dvh] w-full max-w-full overflow-hidden flex flex-col">
          <DrawerHeader className="text-left border-b pb-3 pt-3 flex-shrink-0 flex items-center justify-between">
            <DrawerTitle>{item ? "Редактирование" : "Новая позиция"}</DrawerTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          <DrawerDescription className="sr-only">Заполните форму</DrawerDescription>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {formContent}
          </div>
          <div className="shrink-0 border-t bg-background/95 backdrop-blur px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {actions}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Редактирование позиции" : "Новая позиция неликвида"}</DialogTitle>
          <DialogDescription>Заполните данные позиции</DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
