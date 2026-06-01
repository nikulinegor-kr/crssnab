import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Users, Building2, Hash, X, Package,
  Truck, Box, Warehouse
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "request" | "contractor" | "object" | "invoice" | "supplier" | "shipment" | "product" | "warehouse";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

const ICONS: Record<SearchResult["type"], { icon: typeof FileText; color: string }> = {
  request: { icon: FileText, color: "text-primary" },
  contractor: { icon: Users, color: "text-orange-500" },
  object: { icon: Building2, color: "text-emerald-500" },
  invoice: { icon: Hash, color: "text-purple-500" },
  supplier: { icon: Package, color: "text-blue-500" },
  shipment: { icon: Truck, color: "text-amber-500" },
  product: { icon: Box, color: "text-cyan-500" },
  warehouse: { icon: Warehouse, color: "text-teal-500" },
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  request: "Заявка",
  contractor: "Контрагент",
  object: "Объект",
  invoice: "Счёт",
  supplier: "Поставщик",
  shipment: "Поставка",
  product: "Номенклатура",
  warehouse: "Склад",
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const { data: requests } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: objects } = useQuery({
    queryKey: ["search-objects", currentOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("request_objects")
        .select("id, name, address, contract_number, comment")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["search-suppliers", currentOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, category, contact_person, inn, phone");
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["search-products", currentOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouse_products")
        .select("id, name, article, unit");
      return data || [];
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["search-warehouses", currentOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouses")
        .select("id, name, description, request_objects(name)");
      return data || [];
    },
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    const items: SearchResult[] = [];
    const seen = new Set<string>();

    const matches = (text?: string | null) => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return words.every(w => lower.includes(w));
    };

    // Requests — search by description, applicant, executor, invoice, waybill, comments, request_number
    requests?.forEach(r => {
      if (
        matches(r.description) ||
        matches(r.request_number) ||
        matches(r.applicant) ||
        matches(r.executor) ||
        matches(r.invoice_number) ||
        matches(r.waybill_number) ||
        matches(r.comments)
      ) {
        const key = `req-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "request",
            id: r.id,
            title: r.description,
            subtitle: r.status,
            url: `/requests/${r.id}`,
          });
        }
      }

      // Contractors from requests
      if (matches(r.contractor)) {
        const key = `ctr-${r.contractor}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "contractor",
            id: key,
            title: r.contractor!,
            subtitle: "Контрагент",
            url: `/suppliers`,
          });
        }
      }

      // Invoice numbers
      if (matches(r.invoice_number)) {
        const key = `inv-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "invoice",
            id: r.id,
            title: `Счёт ${r.invoice_number}`,
            subtitle: `Заявка #${r.request_number}`,
            url: `/requests/${r.id}`,
          });
        }
      }

      // Shipments — waybill_number, transport_company, comments
      if (
        matches(r.waybill_number) ||
        matches(r.transport_company)
      ) {
        const key = `ship-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "shipment",
            id: r.id,
            title: r.description || (r.waybill_number ? `ТТН ${r.waybill_number}` : "Поставка"),
            subtitle: [
              r.transport_company || r.waybill_number,
              r.shipment_date ? `отгр. ${new Date(r.shipment_date).toLocaleDateString("ru-RU")}` : null,
              r.delivery_date ? `прих. ${new Date(r.delivery_date).toLocaleDateString("ru-RU")}` : null,
            ].filter(Boolean).join(" • ") || r.status,
            url: `/requests/${r.id}`,
          });
        }
      }

      // Documents — photo_urls, document_urls linked to request
      if (
        (r.document_url && matches(r.description)) ||
        (r.document_urls && r.document_urls.length > 0 && matches(r.description))
      ) {
        const key = `doc-${r.id}`;
        if (!seen.has(key) && !items.find(i => i.id === r.id && i.type === "request")) {
          // Documents are part of requests, link to request detail
        }
      }
    });

    // Objects — name, contract_number, comment
    objects?.forEach(o => {
      if (
        matches(o.name) ||
        matches(o.address) ||
        matches(o.contract_number) ||
        matches(o.comment)
      ) {
        const key = `obj-${o.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "object",
            id: o.id,
            title: o.name,
            subtitle: o.contract_number ? `Контракт ${o.contract_number}` : o.address || "Объект",
            url: `/objects`,
          });
        }
      }
    });

    // Suppliers — name, inn, phone, contact_person
    suppliers?.forEach(s => {
      if (
        matches(s.name) ||
        matches(s.contact_person) ||
        matches(s.inn) ||
        matches(s.phone)
      ) {
        const key = `sup-${s.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "supplier",
            id: s.id,
            title: s.name,
            subtitle: s.inn ? `ИНН ${s.inn}` : s.category || "Поставщик",
            url: `/suppliers`,
          });
        }
      }
    });

    // Products — name, article
    products?.forEach(p => {
      if (matches(p.name) || matches(p.article)) {
        const key = `prod-${p.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "product",
            id: p.id,
            title: p.name,
            subtitle: p.article ? `Арт. ${p.article}` : p.unit || "Товар",
            url: `/warehouse`,
          });
        }
      }
    });

    // Warehouses — name, description
    warehouses?.forEach(w => {
      const objName = (w as any).request_objects?.name;
      if (matches(w.name) || matches(w.description) || matches(objName)) {
        const key = `wh-${w.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "warehouse",
            id: w.id,
            title: objName ? `${objName} — ${w.name}` : w.name,
            subtitle: w.description || "Склад",
            url: `/warehouse`,
          });
        }
      }
    });

    return items.slice(0, 15);
  }, [query, requests, objects, suppliers, products, warehouses]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.url);
    setQuery("");
    setIsOpen(false);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Поиск... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8 h-9 bg-muted/50 border-border/50 text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {results.map((result, idx) => {
                const iconConfig = ICONS[result.type];
                const Icon = iconConfig.icon;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left",
                      "hover:bg-accent/50 transition-colors text-sm",
                      idx === selectedIndex && "bg-accent/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", iconConfig.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-foreground">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider shrink-0">
                      {TYPE_LABELS[result.type]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
