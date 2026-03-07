import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileText, FileImage, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface DocEntry {
  url: string;
  fileName: string;
  type: "photo" | "document";
  requestId: string;
  requestNumber: string;
  requestDescription: string;
  contractor: string | null;
  date: string;
}

const DocumentsPage = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useRequests();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");

  const documents = useMemo(() => {
    if (!requests) return [];
    const docs: DocEntry[] = [];

    requests.forEach(r => {
      // Photo URLs
      r.photo_urls?.forEach(url => {
        const fileName = decodeURIComponent(url.split("/").pop() || "Фото");
        docs.push({
          url,
          fileName,
          type: "photo",
          requestId: r.id,
          requestNumber: r.request_number,
          requestDescription: r.description,
          contractor: r.contractor,
          date: r.request_date,
        });
      });

      // Document URLs
      r.document_urls?.forEach(url => {
        const fileName = decodeURIComponent(url.split("/").pop() || "Документ");
        docs.push({
          url,
          fileName,
          type: "document",
          requestId: r.id,
          requestNumber: r.request_number,
          requestDescription: r.description,
          contractor: r.contractor,
          date: r.request_date,
        });
      });

      // Legacy single photo/doc
      if (r.photo_url && !r.photo_urls?.includes(r.photo_url)) {
        docs.push({
          url: r.photo_url,
          fileName: "Фото",
          type: "photo",
          requestId: r.id,
          requestNumber: r.request_number,
          requestDescription: r.description,
          contractor: r.contractor,
          date: r.request_date,
        });
      }
      if (r.document_url && !r.document_urls?.includes(r.document_url)) {
        docs.push({
          url: r.document_url,
          fileName: "Документ",
          type: "document",
          requestId: r.id,
          requestNumber: r.request_number,
          requestDescription: r.description,
          contractor: r.contractor,
          date: r.request_date,
        });
      }
    });

    return docs
      .filter(d => {
        if (typeFilter !== "all" && d.type !== typeFilter) return false;
        if (contractorFilter !== "all" && d.contractor !== contractorFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            d.fileName.toLowerCase().includes(q) ||
            d.requestNumber.toLowerCase().includes(q) ||
            d.contractor?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [requests, search, typeFilter, contractorFilter]);

  const uniqueContractors = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.filter(r => r.contractor).map(r => r.contractor!))];
  }, [requests]);

  return (
    <div className="w-full p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Документы</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {documents.length} файлов
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени файла, заявке, контрагенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="document">Документы</SelectItem>
            <SelectItem value="photo">Фото</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractorFilter} onValueChange={setContractorFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Контрагент" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все контрагенты</SelectItem>
            {uniqueContractors.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10"></TableHead>
                <TableHead>Файл</TableHead>
                <TableHead>Заявка</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Документы не найдены
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc, i) => (
                  <TableRow key={`${doc.requestId}-${i}`} className="hover:bg-accent/40 transition-colors">
                    <TableCell className="text-center">
                      {doc.type === "photo" ? (
                        <FileImage className="h-4 w-4 text-blue-500 mx-auto" />
                      ) : (
                        <FileText className="h-4 w-4 text-orange-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[250px] truncate">
                      {doc.fileName}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => navigate(`/requests/${doc.requestId}`)}
                        className="text-sm text-primary hover:underline max-w-[200px] truncate block text-left"
                        title={doc.requestDescription}
                      >
                        {doc.requestDescription || `#${doc.requestNumber}`}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.contractor || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(doc.date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default DocumentsPage;
