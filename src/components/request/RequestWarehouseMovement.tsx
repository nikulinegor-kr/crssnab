import { useEffect } from "react";
import { useRequestWarehouseMovement } from "@/hooks/useRequestWarehouseMovement";

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });
const quantity = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 });

function MovementTime({ at }: { at: string }) {
  return <time dateTime={at} className="font-numeric text-xs text-muted-foreground">{dateTime.format(new Date(at))}</time>;
}

export function RequestWarehouseMovement({ requestId, organizationId, enabled = true, onReady }: {
  requestId: string;
  organizationId: string | null;
  enabled?: boolean;
  onReady?: () => void;
}) {
  const { receipts, movements, hasAcceptedStock } = useRequestWarehouseMovement(organizationId, requestId, enabled);
  const isReady = enabled && !receipts.isPending && (!hasAcceptedStock || !movements.isPending);
  useEffect(() => { if (isReady) onReady?.(); }, [isReady, onReady]);
  if (!organizationId || !enabled) return null;

  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-foreground">Складская приёмка</h3>
        {receipts.isError ? (
          <p role="alert" className="mt-2 text-muted-foreground">Не удалось загрузить приёмку.</p>
        ) : receipts.isPending ? (
          <p role="status" className="mt-2 text-muted-foreground">Загружаем приёмку…</p>
        ) : receipts.data.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Складская приёмка пока не оформлена.</p>
        ) : (
          <ol className="mt-2 divide-y divide-border">
            {receipts.data.map(receipt => (
              <li key={receipt.id} className="space-y-2 py-2 first:pt-0">
                <MovementTime at={receipt.at} />
                <dl className="grid grid-cols-2 gap-3 break-words">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Кто принял</dt>
                    <dd className="font-medium">{receipt.receiver}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Склад</dt>
                    <dd className="font-medium">{receipt.warehouse}</dd>
                  </div>
                </dl>
                {!receipt.documentId && <p className="text-xs text-muted-foreground">Зафиксирован брак. На склад ничего не зачислено.</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
      {hasAcceptedStock && (
        <div className="border-t border-border pt-3">
          <h3 className="font-semibold text-foreground">После приёмки</h3>
          {movements.isError ? (
            <p role="alert" className="mt-2 text-muted-foreground">Не удалось загрузить складские операции.</p>
          ) : movements.isPending ? (
            <p role="status" className="mt-2 text-muted-foreground">Загружаем складские операции…</p>
          ) : movements.data.length === 0 ? (
            <p className="mt-2 text-muted-foreground">Складских операций пока нет.</p>
          ) : (
            <ol className="mt-2 divide-y divide-border">
              {movements.data.map(event => (
                <li key={event.id} className="min-w-0 space-y-1 py-2 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium">{event.title}</span>
                    <MovementTime at={event.at} />
                  </div>
                  <p className="break-words">{event.route}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {event.item} · <span className="font-numeric">{quantity.format(event.quantity)} {event.unit}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
