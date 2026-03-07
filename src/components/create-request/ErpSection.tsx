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
import { Checkbox } from "@/components/ui/checkbox";
import { FormSectionCard } from "./FormSectionCard";
import { Package, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StockInfoCard } from "./StockInfoCard";

interface ErpSectionProps {
  form: UseFormReturn<any>;
  currentOrgId: string | null;
  disabled?: boolean;
}

const UNITS = ["шт", "кг", "м", "комплект"];
const OPERATION_TYPES = [
  { value: "purchase", label: "Закупка" },
  { value: "issue", label: "Выдача со склада" },
  { value: "transfer", label: "Перемещение" },
];

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
    queryKey: ["warehouses-with-objects", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*, request_objects(name)")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const selectedProductId = form.watch("product_id");
  const selectedWarehouseId = form.watch("warehouse_id");

  // When product is selected, update article search display
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find((p: any) => p.id === selectedProductId);
      if (product) {
        setArticleSearch(product.article || "");
        // Auto-fill unit from product if available
        if (product.unit) {
          form.setValue("unit", product.unit);
        }
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
      if (product.unit) {
        form.setValue("unit", product.unit);
      }
    }
  };

  const handleArticleClear = () => {
    setArticleSearch("");
    form.setValue("product_id", "");
  };


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
                    const realVal = val === "__none__" ? "" : val;
                    field.onChange(realVal);
                    const product = products.find((p: any) => p.id === realVal);
                    if (product) {
                      setArticleSearch(product.article || "");
                      if (product.unit) {
                        form.setValue("unit", product.unit);
                      }
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
                    <SelectItem value="__none__">— Не выбран —</SelectItem>
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

        {/* Stock info card - show when product is selected */}
        {selectedProductId && currentOrgId && (
          <StockInfoCard
            productId={selectedProductId}
            warehouseId={selectedWarehouseId}
            organizationId={currentOrgId}
          />
        )}

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Количество</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
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

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ед. измерения</FormLabel>
                <Select
                  value={field.value || "шт"}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operation_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Тип операции</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">— Не выбран —</SelectItem>
                    {OPERATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Warehouse + Planned delivery date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Целевой склад</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите склад" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">— Не выбран —</SelectItem>
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="planned_delivery_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Плановая дата поставки</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    className="h-9 text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Reserve checkbox */}
        <FormField
          control={form.control}
          name="reserve_on_warehouse"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                  disabled={disabled || !selectedProductId || !selectedWarehouseId}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-xs font-normal cursor-pointer">
                  Зарезервировать товар на складе
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
      </div>
    </FormSectionCard>
  );
};
