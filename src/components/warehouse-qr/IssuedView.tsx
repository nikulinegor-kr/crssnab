import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { warehouseRows } from "@/lib/simpleWarehouse";
import { IssueActionsDialog, type ActionIssue } from "./IssueActionsDialog";
import { WarehouseIssues, type IssueDisplayRow } from "./WarehouseIssues";

const SELECT =
  "id,organization_id,unit_id,warehouse_id,recipient_name,recipient_user_id,equipment_id,object_id,operation_date,created_at,issued_qty,returned_qty,installed_qty,consumed_qty,note,received_confirmed_at,received_confirmed_proxy";

async function inChunks<T>(
  ids: string[],
  load: (
    chunk: string[],
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await load(ids.slice(i, i + 200));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/** "Выдано": objects / equipment / employees with search, current "числится" apart from issued history. */
export function IssuedView({
  orgId,
  warehouseId,
}: {
  orgId: string;
  warehouseId?: string;
}) {
  const [action, setAction] = useState<{
    row: IssueDisplayRow;
    initial: "return" | "consume";
  } | null>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["wh-qr", "issued", orgId, warehouseId ?? "all"],
    queryFn: async () => {
      const issues = await warehouseRows<ActionIssue>((from, to) => {
        let query = supabase
          .from("warehouse_issues")
          .select(SELECT)
          .eq("organization_id", orgId);
        if (warehouseId) query = query.eq("warehouse_id", warehouseId);
        return query
          .order("operation_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to);
      });
      const uniq = (xs: (string | null)[]) => [
        ...new Set(xs.filter((x): x is string => !!x)),
      ];
      const [units, objects, equipment, warehouses] = await Promise.all([
        inChunks<{ id: string; name: string; unit: string }>(
          uniq(issues.map((i) => i.unit_id)),
          (c) =>
            supabase
              .from("warehouse_units")
              .select("id,name,unit")
              .eq("organization_id", orgId)
              .in("id", c),
        ),
        inChunks<{ id: string; name: string }>(
          uniq(issues.map((i) => i.object_id)),
          (c) =>
            supabase
              .from("request_objects")
              .select("id,name")
              .eq("organization_id", orgId)
              .in("id", c),
        ),
        inChunks<{ id: string; model: string; plate_number: string | null }>(
          uniq(issues.map((i) => i.equipment_id)),
          (c) =>
            supabase
              .from("equipment")
              .select("id,model,plate_number")
              .eq("organization_id", orgId)
              .in("id", c),
        ),
        inChunks<{ id: string; name: string }>(
          uniq(issues.map((i) => i.warehouse_id)),
          (c) =>
            supabase
              .from("warehouses")
              .select("id,name")
              .eq("organization_id", orgId)
              .in("id", c),
        ),
      ]);
      return { issues, units, objects, equipment, warehouses };
    },
  });
  const rows = useMemo<IssueDisplayRow[]>(() => {
    if (!data) return [];
    const units = new Map(data.units.map((unit) => [unit.id, unit]));
    const objects = new Map(
      data.objects.map((object) => [object.id, object.name]),
    );
    const equipment = new Map(
      data.equipment.map((item) => [
        item.id,
        [item.plate_number, item.model].filter(Boolean).join(" · "),
      ]),
    );
    const warehouses = new Map(
      data.warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
    );
    return data.issues.map((issue) => ({
      ...issue,
      unitName: units.get(issue.unit_id)?.name ?? "ТМЦ недоступна",
      unit: units.get(issue.unit_id)?.unit ?? "",
      targetName: issue.object_id
        ? (objects.get(issue.object_id) ?? "Объект недоступен")
        : issue.equipment_id
          ? (equipment.get(issue.equipment_id) ?? "Техника недоступна")
          : "",
      warehouseName: warehouses.get(issue.warehouse_id) ?? "Склад недоступен",
    }));
  }, [data]);
  if (isLoading)
    return (
      <p role="status" className="wh-empty">
        Загрузка выдач…
      </p>
    );
  if (error)
    return (
      <div className="wh-empty" role="alert">
        <h2>Не удалось загрузить выдачи</h2>
        <p>{(error as Error).message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  return (
    <>
      <WarehouseIssues
        key={warehouseId ?? "all"}
        rows={rows}
        scoped={!!warehouseId}
        onAction={(row, initial) => setAction({ row, initial })}
      />
      <IssueActionsDialog
        orgId={orgId}
        open={!!action}
        onOpenChange={(value) => {
          if (!value) setAction(null);
        }}
        issue={action?.row ?? null}
        unitName={action?.row.unitName ?? ""}
        unit={action?.row.unit ?? ""}
        initial={action?.initial ?? "return"}
      />
    </>
  );
}
