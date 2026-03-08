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
import { Input } from "@/components/ui/input";
import { FormSectionCard } from "./FormSectionCard";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StockInfoCard } from "./StockInfoCard";

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
  const [showDropdown, setShowDropdown] = useState(false);

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

  const selectedProductId = form.watch("product_id");
  const selectedWarehouseId = form.watch("warehouse_id");

  // Sync display when product selected
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find((p: any) => p.id === selectedProductId);
      if (product) {
        setArticleSearch(product.article ? `${product.name} (${product.article})` : product.name);
        if (product.unit) {
          form.setValue("unit", product.unit);
        }
      }
      setShowDropdown(false);
    }
  }, [selectedProductId, products]);

  const filteredProducts = articleSearch && !selectedProductId
    ? products.filter(
        (p: any) =>
          p.article?.toLowerCase().includes(articleSearch.toLowerCase()) ||
          p.name?.toLowerCase().includes(articleSearch.toLowerCase())
      )
    : [];

  const handleProductSelect = (productId: string) => {
    form.setValue("product_id", productId);
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      setArticleSearch(product.article ? `${product.name} (${product.article})` : product.name);
      if (product.unit) {
        form.setValue("unit", product.unit);
      }
    }
    setShowDropdown(false);
  };

  const handleSearchChange = (value: string) => {
    setArticleSearch(value);
    if (!value) {
      form.setValue("product_id", "");
    } else {
      // Clear selection so user can re-search
      if (selectedProductId) {
        form.setValue("product_id", "");
      }
      setShowDropdown(true);
    }
  };

  const handleClear = () => {
    setArticleSearch("");
    form.setValue("product_id", "");
    setShowDropdown(false);
  };

  return (
    <FormSectionCard
      title="Проверка наличия"
      icon={<Search className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        {/* Article search */}
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <div className="space-y-1.5 relative">
            <FormLabel className="text-xs">Артикул / Товар</FormLabel>
            <div className="relative">
              <Input
                placeholder="Поиск по артикулу или названию..."
                value={articleSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                disabled={disabled}
                className="h-9 text-sm pr-7"
              />
              {articleSearch && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                >
                  ×
                </button>
              )}
            </div>
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-50 w-full border rounded-md bg-popover shadow-md max-h-[150px] overflow-auto mt-1">
                {filteredProducts.slice(0, 8).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 flex justify-between items-center"
                    onClick={() => handleProductSelect(p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.article || ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Кол-во</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={field.value ?? 1}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : 1;
                      field.onChange(val);
                    }}
                    disabled={disabled}
                    className="h-9 text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Stock info */}
        {selectedProductId && currentOrgId && (
          <StockInfoCard
            productId={selectedProductId}
            warehouseId={selectedWarehouseId}
            organizationId={currentOrgId}
          />
        )}
      </div>
    </FormSectionCard>
  );
};
