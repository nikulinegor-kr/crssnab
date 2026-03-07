import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormSectionCard } from "./FormSectionCard";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ErpSectionProps {
  form: UseFormReturn<any>;
  currentOrgId: string | null;
  disabled?: boolean;
}

export const ErpSection = ({
  form,
  currentOrgId,
  disabled = false,
}: ErpSectionProps) => {
  const [articleSearch, setArticleSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["warehouse-products", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_products")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const selectedProductId = form.watch("product_id");

  // When product is selected, update article search display
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find((p: any) => p.id === selectedProductId);
      if (product) {
        setArticleSearch(product.article || "");
      }
    }
  }, [selectedProductId, products]);

  // Filter products by article search
  const filteredProducts = articleSearch
    ? products.filter(
        (p: any) =>
          p.article?.toLowerCase().includes(articleSearch.toLowerCase()) ||
          p.name?.toLowerCase().includes(articleSearch.toLowerCase())
      )
    : products;

  const handleProductSelect = (productId: string) => {
    form.setValue("product_id", productId);
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      setArticleSearch(product.article || "");
    }
  };

  const handleArticleClear = () => {
    setArticleSearch("");
    form.setValue("product_id", "");
  };

  if (products.length === 0 && warehouses.length === 0) {
    return null; // Don't show section if no ERP data exists
  }

  return (
    <FormSectionCard
      title="ERP / Склад"
      icon={<Package className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Article search + Product select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div className="space-y-1.5">
            <FormLabel className="text-xs">Артикул</FormLabel>
            <div className="relative">
              <Input
                placeholder="Поиск по артикулу..."
                value={articleSearch}
                onChange={(e) => {
                  setArticleSearch(e.target.value);
                  if (!e.target.value) {
                    form.setValue("product_id", "");
                  }
                }}
                disabled={disabled}
                className="h-9 text-sm"
              />
              {articleSearch && (
                <button
                  type="button"
                  onClick={handleArticleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
            {/* Dropdown with filtered products */}
            {articleSearch && !selectedProductId && filteredProducts.length > 0 && (
              <div className="border rounded-md bg-popover shadow-md max-h-[150px] overflow-auto">
                {filteredProducts.slice(0, 10).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 flex justify-between items-center"
                    onClick={() => handleProductSelect(p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.article || ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Товар из номенклатуры</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const product = products.find((p: any) => p.id === val);
                    if (product) {
                      setArticleSearch(product.article || "");
                    }
                  }}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите товар" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">— Не выбран —</SelectItem>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.article ? `(${p.article})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Warehouse select */}
        <FormField
          control={form.control}
          name="warehouse_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Целевой склад</FormLabel>
              <Select
                value={field.value || ""}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите склад" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">— Не выбран —</SelectItem>
                  {warehouses.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSectionCard>
  );
};
