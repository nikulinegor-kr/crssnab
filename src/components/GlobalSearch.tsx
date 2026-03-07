import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, FileText, Users, Building2, Hash, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "request" | "contractor" | "object" | "invoice" | "supplier";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { data: requests } = useRequests();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: objects } = useQuery({
    queryKey: ["search-objects"],
    queryFn: async () => {
      const { data } = await supabase.from("request_objects").select("id, name, address").eq("is_active", true);
      return data || [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["search-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, category, contact_person");
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
    const items: SearchResult[] = [];
    const seen = new Set<string>();

    // Search requests
    requests?.forEach(r => {
      if (
        r.description?.toLowerCase().includes(q) ||
        r.request_number?.toLowerCase().includes(q)
      ) {
        const key = `req-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "request",
            id: r.id,
            title: `#${r.request_number} — ${r.description}`,
            subtitle: r.status,
            url: `/requests/${r.id}`,
          });
        }
      }

      // Contractors from requests
      if (r.contractor?.toLowerCase().includes(q)) {
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
      if (r.invoice_number?.toLowerCase().includes(q)) {
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
    });

    // Search objects
    objects?.forEach(o => {
      if (o.name?.toLowerCase().includes(q) || o.address?.toLowerCase().includes(q)) {
        const key = `obj-${o.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "object",
            id: o.id,
            title: o.name,
            subtitle: o.address || "Объект",
            url: `/objects`,
          });
        }
      }
    });

    // Search suppliers
    suppliers?.forEach(s => {
      if (
        s.name?.toLowerCase().includes(q) ||
        s.contact_person?.toLowerCase().includes(q)
      ) {
        const key = `sup-${s.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            type: "supplier",
            id: s.id,
            title: s.name,
            subtitle: s.category || "Поставщик",
            url: `/suppliers`,
          });
        }
      }
    });

    return items.slice(0, 10);
  }, [query, requests, objects, suppliers]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "request": return <FileText className="h-4 w-4 text-primary" />;
      case "contractor": return <Users className="h-4 w-4 text-orange-500" />;
      case "object": return <Building2 className="h-4 w-4 text-emerald-500" />;
      case "invoice": return <Hash className="h-4 w-4 text-purple-500" />;
      case "supplier": return <Package className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "request": return "Заявка";
      case "contractor": return "Контрагент";
      case "object": return "Объект";
      case "invoice": return "Счёт";
      case "supplier": return "Поставщик";
    }
  };

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
            <div className="max-h-[340px] overflow-y-auto">
              {results.map((result, idx) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left",
                    "hover:bg-accent/50 transition-colors text-sm",
                    idx === selectedIndex && "bg-accent/50"
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-foreground">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider shrink-0">
                    {getTypeLabel(result.type)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
