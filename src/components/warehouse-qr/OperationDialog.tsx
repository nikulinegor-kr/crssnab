import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRightLeft,
  Check,
  PackageMinus,
  UserRound,
  UserRoundPen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskLookupSelect } from "@/components/tasks/TaskLookupSelect";
import { useToast } from "@/hooks/use-toast";
import { warehouseRows } from "@/lib/simpleWarehouse";
import { fmtQty } from "@/lib/issueStatus";
import type { WhBalance, WhUnit, WhWarehouse } from "./types";
import "./warehouse-workspace.css";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  orgId: string;
  type: "move" | "issue";
  unit: WhUnit | null;
  units?: WhUnit[];
  warehouses: (WhWarehouse & { archived_at?: string | null })[];
  balances: WhBalance[];
  fromWarehouseId?: string;
}
type Mode = "equipment" | "object" | "employee";
export function OperationDialog({
  open,
  onOpenChange,
  orgId,
  type,
  unit: fixedUnit,
  units = [],
  warehouses,
  balances,
  fromWarehouseId,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [unitId, setUnitId] = useState<string | null>(null);
  const unit = fixedUnit ?? units.find((item) => item.id === unitId) ?? null;
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [recipient, setRecipient] = useState("");
  const [recipientUser, setRecipientUser] = useState<string | null>(null);
  const [manualRecipient, setManualRecipient] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>("employee");
  const [destination, setDestination] = useState<string | null>(null);
  const [consumeNow, setConsumeNow] = useState(false);
  const [key, setKey] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const submitting = useRef(false);
  const activeBalances = balances.filter(
    (balance) =>
      !warehouses.find((warehouse) => warehouse.id === balance.warehouse_id)
        ?.archived_at,
  );
  const stocks = useMemo(
    () =>
      warehouses
        .filter((warehouse) => !warehouse.archived_at)
        .map((warehouse) => ({
          ...warehouse,
          quantity: balances
            .filter(
              (balance) =>
                balance.unit_id === unit?.id &&
                balance.warehouse_id === warehouse.id,
            )
            .reduce((total, balance) => total + Number(balance.quantity), 0),
        }))
        .filter((warehouse) => warehouse.quantity > 0),
    [balances, warehouses, unit],
  );
  const selectableUnits = units.filter((item) =>
    activeBalances.some(
      (balance) =>
        balance.unit_id === item.id &&
        (!fromWarehouseId || balance.warehouse_id === fromWarehouseId) &&
        Number(balance.quantity) > 0,
    ),
  );

  useEffect(() => {
    if (!open) return;
    setUnitId(null);
    setSource(fromWarehouseId ?? null);
    setTarget(null);
    setQty("1");
    setRecipient("");
    setRecipientUser(null);
    setManualRecipient(false);
    setMode("employee");
    setConsumeNow(false);
    setNote("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setDestination(null);
    setConfirm(false);
    setAttempted(false);
    setKey(crypto.randomUUID());
  }, [open, fromWarehouseId, fixedUnit?.id]);
  useEffect(() => {
    if (open && unit && !source) setSource(stocks[0]?.id ?? null);
  }, [open, unit, stocks, source]);

  const { data: objects = [], error: objectError } = useQuery({
    queryKey: ["wh-objects", orgId],
    enabled: open && type === "issue" && mode === "object",
    queryFn: () =>
      warehouseRows<{ id: string; name: string }>((from, to) =>
        supabase
          .from("request_objects")
          .select("id,name")
          .eq("organization_id", orgId)
          .order("name")
          .range(from, to),
      ),
  });
  const { data: equipment = [], error: equipmentError } = useQuery({
    queryKey: ["wh-equipment", orgId],
    enabled: open && type === "issue" && mode === "equipment",
    queryFn: () =>
      warehouseRows<{
        id: string;
        model: string;
        plate_number: string | null;
        brand: string;
      }>((from, to) =>
        supabase
          .from("equipment")
          .select("id,model,plate_number,brand")
          .eq("organization_id", orgId)
          .order("model")
          .range(from, to),
      ),
  });
  const {
    data: members = [],
    error: memberError,
    isLoading: membersLoading,
  } = useQuery({
    queryKey: ["wh-members", orgId],
    enabled: open && type === "issue" && !manualRecipient,
    queryFn: async () => {
      const memberships = await warehouseRows<{ user_id: string }>((from, to) =>
        supabase
          .from("user_organizations")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("user_id")
          .range(from, to),
      );
      const people: { id: string; name: string }[] = [];
      for (let start = 0; start < memberships.length; start += 200) {
        const ids = memberships
          .slice(start, start + 200)
          .map((member) => member.user_id);
        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", ids);
        if (error) throw error;
        people.push(
          ...(data ?? []).map((person) => ({
            id: person.id,
            name: person.full_name || "Без имени",
          })),
        );
      }
      return people.sort((left, right) =>
        left.name.localeCompare(right.name, "ru"),
      );
    },
  });
  const quantity = Number(qty.replace(",", "."));
  const available = stocks.find((stock) => stock.id === source)?.quantity ?? 0;
  const errors: string[] = [];
  if (!unit) errors.push("Выберите ТМЦ");
  if (!Number.isFinite(quantity) || quantity <= 0)
    errors.push("Укажите количество больше нуля");
  if (unit && quantity > available)
    errors.push(`Доступно ${fmtQty(available)} ${unit.unit}`);
  if (unit?.kind === "item" && quantity !== 1)
    errors.push("Изделие учитывается поштучно");
  if (
    !source ||
    warehouses.find((warehouse) => warehouse.id === source)?.archived_at
  )
    errors.push("Выберите действующий склад с остатком");
  if (type === "move" && (!target || target === source))
    errors.push("Выберите другой склад");
  if (type === "issue") {
    if (!recipient.trim()) errors.push("Укажите получателя");
    if (!manualRecipient && !recipientUser)
      errors.push("Выберите сотрудника или включите ручной ввод");
    if (!date) errors.push("Укажите дату выдачи");
    if (mode !== "employee" && !destination)
      errors.push(
        mode === "equipment" ? "Выберите технику" : "Выберите объект",
      );
    const referenceError =
      mode === "equipment"
        ? equipmentError
        : mode === "object"
          ? objectError
          : null;
    if (referenceError) errors.push("Не удалось загрузить назначение выдачи");
  }
  const save = async () => {
    // A retry reuses the reviewed payload and key even if refreshed stock is lower.
    if (!unit || (!attempted && errors.length > 0) || submitting.current)
      return;
    submitting.current = true;
    setBusy(true);
    setAttempted(true);
    try {
      const result =
        type === "move"
          ? await supabase.rpc("simple_warehouse_operation", {
              _operation_key: key,
              _unit_id: unit.id,
              _type: "move",
              _from_warehouse_id: source!,
              _to_warehouse_id: target!,
              _quantity: quantity,
              _recipient: "",
              _operation_date: date,
              _equipment_id: null,
              _object_id: null,
            })
          : await supabase.rpc(
              consumeNow ? "warehouse_issue_and_consume" : "warehouse_issue",
              {
                _operation_key: key,
                _unit_id: unit.id,
                _from_warehouse_id: source!,
                _quantity: quantity,
                _recipient: recipient.trim(),
                _recipient_user_id: manualRecipient ? null : recipientUser,
                _operation_date: date,
                _equipment_id: mode === "equipment" ? destination : null,
                _object_id: mode === "object" ? destination : null,
                _note: note,
              },
            );
      if (result.error) throw result.error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["wh-qr"] }),
        qc.invalidateQueries({ queryKey: ["wh-my-issues"] }),
      ]);
      toast({
        title:
          type === "move"
            ? "Перемещено"
            : consumeNow
              ? "Выдано и списано"
              : "Выдано сотруднику",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Операция не выполнена",
        description: (error as { message?: string })?.message ?? String(error),
        variant: "destructive",
      });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const destinationName =
    mode === "object"
      ? objects.find((object) => object.id === destination)?.name
      : equipment.find((item) => item.id === destination)?.model;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent
        className="wh-operation-dialog"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {type === "move" ? "Перемещение ТМЦ" : "Выдача со склада"}
          </DialogTitle>
          <DialogDescription>
            {confirm
              ? "Проверьте получателя и количество перед проведением."
              : "Укажите ТМЦ, получателя и способ учёта."}
          </DialogDescription>
        </DialogHeader>
        <div className="wh-operation-body">
          {!confirm ? (
            <>
              {!fixedUnit && (
                <div className="wh-field">
                  <Label>ТМЦ</Label>
                  <TaskLookupSelect
                    label="Выберите ТМЦ"
                    value={unitId}
                    onChange={(id) => {
                      setUnitId(id);
                      setQty("1");
                    }}
                    options={selectableUnits.map((item) => ({
                      id: item.id,
                      name: item.name,
                    }))}
                  />
                </div>
              )}
              {unit && (
                <div className="wh-operation-item">
                  <span className="wh-operation-icon">
                    {type === "move" ? <ArrowRightLeft /> : <PackageMinus />}
                  </span>
                  <div>
                    <strong>{unit.name}</strong>
                    <span>
                      {warehouses.find((warehouse) => warehouse.id === source)
                        ?.name || "Выберите склад"}{" "}
                      · доступно {fmtQty(available)} {unit.unit}
                    </span>
                  </div>
                </div>
              )}
              <div className="wh-form-grid">
                {stocks.length > 1 && (
                  <div className="wh-field wh-field-wide">
                    <Label>Со склада</Label>
                    <TaskLookupSelect
                      label="Склад отправления"
                      value={source}
                      onChange={setSource}
                      options={stocks.map((stock) => ({
                        id: stock.id,
                        name: `${stock.name} · ${fmtQty(stock.quantity)} ${unit?.unit ?? ""}`,
                      }))}
                    />
                  </div>
                )}
                <div className="wh-field">
                  <Label htmlFor="op-quantity">
                    Количество{unit ? `, ${unit.unit}` : ""}
                  </Label>
                  <Input
                    id="op-quantity"
                    inputMode="decimal"
                    value={qty}
                    disabled={unit?.kind === "item"}
                    onChange={(event) => setQty(event.target.value)}
                  />
                </div>
                <div className="wh-field">
                  <Label htmlFor="op-date">
                    Дата{type === "issue" ? " выдачи" : ""}
                  </Label>
                  <Input
                    id="op-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
              </div>
              {type === "move" ? (
                <div className="wh-field">
                  <Label>Куда переместить</Label>
                  <TaskLookupSelect
                    label="Склад назначения"
                    value={target}
                    onChange={setTarget}
                    options={warehouses
                      .filter(
                        (warehouse) =>
                          warehouse.id !== source && !warehouse.archived_at,
                      )
                      .map((warehouse) => ({
                        id: warehouse.id,
                        name: warehouse.name,
                      }))}
                  />
                </div>
              ) : (
                <>
                  <section className="wh-form-section">
                    <h3>Получатель</h3>
                    <div
                      className="wh-choice-row"
                      aria-label="Способ выбора получателя"
                    >
                      <Button
                        variant={!manualRecipient ? "secondary" : "ghost"}
                        aria-pressed={!manualRecipient}
                        onClick={() => {
                          setManualRecipient(false);
                          setRecipient("");
                          setRecipientUser(null);
                        }}
                      >
                        <UserRound />
                        Из списка
                      </Button>
                      <Button
                        variant={manualRecipient ? "secondary" : "ghost"}
                        aria-pressed={manualRecipient}
                        onClick={() => {
                          setManualRecipient(true);
                          setRecipientUser(null);
                          setRecipient("");
                        }}
                      >
                        <UserRoundPen />
                        Ввести вручную
                      </Button>
                    </div>
                    {manualRecipient ? (
                      <div className="wh-field">
                        <Label htmlFor="op-recipient">ФИО сотрудника</Label>
                        <Input
                          id="op-recipient"
                          autoComplete="off"
                          placeholder="Например, Иванов Иван Петрович"
                          value={recipient}
                          onChange={(event) => setRecipient(event.target.value)}
                        />
                        <p className="wh-field-help">
                          Имя сохранится в выдаче. Создавать аккаунт для
                          получателя не требуется.
                        </p>
                      </div>
                    ) : (
                      <div className="wh-field">
                        <Label>Сотрудник организации</Label>
                        <TaskLookupSelect
                          label={
                            membersLoading
                              ? "Загрузка сотрудников…"
                              : "Выберите сотрудника"
                          }
                          value={recipientUser}
                          onChange={(id) => {
                            setRecipientUser(id);
                            setRecipient(
                              members.find((member) => member.id === id)
                                ?.name ?? "",
                            );
                          }}
                          options={members}
                        />
                        {memberError && (
                          <p role="alert" className="wh-field-error">
                            Список не загрузился. Используйте ручной ввод.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                  <section className="wh-form-section">
                    <h3>Назначение</h3>
                    <div className="wh-choice-row wh-choice-three">
                      {(
                        [
                          ["employee", "Сотруднику"],
                          ["object", "На объект"],
                          ["equipment", "На технику"],
                        ] as const
                      ).map(([value, title]) => (
                        <Button
                          key={value}
                          variant={mode === value ? "secondary" : "ghost"}
                          aria-pressed={mode === value}
                          onClick={() => {
                            setMode(value);
                            setDestination(null);
                          }}
                        >
                          {title}
                        </Button>
                      ))}
                    </div>
                    {mode !== "employee" && (
                      <TaskLookupSelect
                        label={
                          mode === "equipment"
                            ? "Выберите технику"
                            : "Выберите объект"
                        }
                        value={destination}
                        onChange={setDestination}
                        options={
                          mode === "object"
                            ? objects
                            : equipment.map((item) => ({
                                id: item.id,
                                name: [
                                  item.plate_number,
                                  item.model,
                                  item.brand,
                                ]
                                  .filter(Boolean)
                                  .join(" · "),
                              }))
                        }
                      />
                    )}
                  </section>
                  <section className="wh-form-section">
                    <h3>Как учитывать выдачу</h3>
                    <div className="wh-dispositions">
                      <button
                        type="button"
                        aria-pressed={!consumeNow}
                        onClick={() => setConsumeNow(false)}
                      >
                        <span>
                          <strong>Оставить на сотруднике</strong>
                          <small>
                            Будет числиться до возврата или списания
                          </small>
                        </span>
                        {!consumeNow && <Check />}
                      </button>
                      <button
                        type="button"
                        aria-pressed={consumeNow}
                        onClick={() => setConsumeNow(true)}
                      >
                        <span>
                          <strong>Сразу списать в расход</strong>
                          <small>
                            Выдача и расход сохранятся одной операцией
                          </small>
                        </span>
                        {consumeNow && <Check />}
                      </button>
                    </div>
                  </section>
                  <div className="wh-field">
                    <Label htmlFor="op-note">Комментарий</Label>
                    <Textarea
                      id="op-note"
                      placeholder="Для каких работ или по какой причине"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="wh-confirmation">
              <div className="wh-operation-item">
                <span className="wh-operation-icon">
                  <PackageMinus />
                </span>
                <div>
                  <strong>{unit?.name}</strong>
                  <span>
                    {fmtQty(quantity)} {unit?.unit}
                  </span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Со склада</dt>
                  <dd>
                    {
                      warehouses.find((warehouse) => warehouse.id === source)
                        ?.name
                    }
                  </dd>
                </div>
                {type === "move" ? (
                  <div>
                    <dt>На склад</dt>
                    <dd>
                      {
                        warehouses.find((warehouse) => warehouse.id === target)
                          ?.name
                      }
                    </dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>Получатель</dt>
                      <dd>{recipient}</dd>
                    </div>
                    {mode !== "employee" && (
                      <div>
                        <dt>{mode === "object" ? "Объект" : "Техника"}</dt>
                        <dd>{destinationName}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Учёт</dt>
                      <dd>
                        {consumeNow
                          ? "Сразу списать в расход"
                          : "Останется на сотруднике"}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Дата</dt>
                  <dd>{date.split("-").reverse().join(".")}</dd>
                </div>
                {note && (
                  <div>
                    <dt>Комментарий</dt>
                    <dd>{note}</dd>
                  </div>
                )}
              </dl>
              {consumeNow && (
                <p className="wh-operation-notice">
                  Количество уйдёт со склада и будет отражено в расходе.
                  Получатель и история выдачи сохранятся.
                </p>
              )}
            </div>
          )}
          {!attempted && errors.length > 0 && (
            <ul className="wh-validation" aria-live="polite">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="wh-operation-footer">
          {confirm ? (
            <>
              <Button
                variant="outline"
                disabled={busy || attempted}
                onClick={() => setConfirm(false)}
              >
                Назад
              </Button>
              <Button
                disabled={busy || (!attempted && errors.length > 0)}
                onClick={save}
              >
                {busy
                  ? "Сохранение…"
                  : attempted
                    ? "Повторить операцию"
                    : type === "move"
                      ? "Переместить"
                      : consumeNow
                        ? "Выдать и списать"
                        : "Подтвердить выдачу"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                disabled={errors.length > 0}
                onClick={() => setConfirm(true)}
              >
                Продолжить
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
