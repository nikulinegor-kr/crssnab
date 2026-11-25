import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  ScanLine,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readWarehouseDescription } from "@/lib/simpleWarehouse";
import { fmtQty } from "@/lib/issueStatus";
import {
  filterWarehouseStock,
  warehouseStockRows,
  warehouseSummary,
  type WarehouseProduct,
  type WarehouseStockRow,
} from "@/lib/warehouseView";
import type { WhBalance, WhUnit, WhWarehouse } from "./types";
import "./warehouse-workspace.css";

export interface DirectoryWarehouse extends WhWarehouse {
  description: string | null;
  archived_at: string | null;
  request_objects: { name: string } | null;
}

interface Props {
  warehouses: DirectoryWarehouse[];
  units: WhUnit[];
  balances: WhBalance[];
  products: WarehouseProduct[];
  warehouseId: string | null;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  canArchive: boolean;
  onChoose: (id: string | null) => void;
  onAdd: () => void;
  onEdit: (warehouse: DirectoryWarehouse) => void;
  onArchive: (warehouse: DirectoryWarehouse) => void;
  onScan: () => void;
  onReceive: () => void;
  onIssue: () => void;
  onInventory: () => void;
  onUnit: (unit: WhUnit) => void;
  onLabels: (units: WhUnit[]) => void;
  labelsBusy: boolean;
  issued: ReactNode;
  journal: ReactNode;
}

function Responsible({ name }: { name: string }) {
  if (!name) return <span className="wh-muted">Не назначен</span>;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <span className="wh-person">
      <span className="wh-avatar" aria-hidden="true">
        {initials}
      </span>
      <span>{name}</span>
    </span>
  );
}

function StockBadge({ row }: { row: WarehouseStockRow }) {
  const labels = { normal: "Норма", low: "Мало", unknown: "Без порога" };
  return (
    <span
      className={`wh-stock wh-stock-${row.stock}`}
      title={
        row.minimum == null
          ? "Минимальный остаток не задан"
          : `Минимум по товару на складе — ${fmtQty(row.minimum)} ${row.unit.unit}`
      }
    >
      {labels[row.stock]}
    </span>
  );
}

export function WarehouseWorkspace(props: Props) {
  const workspace = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("stock");
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState("all");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(60);
  useEffect(() => {
    setSearch("");
    setStock("all");
    setCategory("all");
    setLimit(60);
    setTab("stock");
    workspace.current?.scrollIntoView({ block: "start" });
  }, [props.warehouseId]);
  const warehouse = props.warehouses.find(
    (item) => item.id === props.warehouseId,
  );
  const rowsByWarehouse = useMemo(
    () =>
      new Map(
        props.warehouses.map((item) => [
          item.id,
          warehouseStockRows(
            props.units,
            props.balances,
            props.products,
            item.id,
          ),
        ]),
      ),
    [props.warehouses, props.units, props.balances, props.products],
  );
  const rows = rowsByWarehouse.get(props.warehouseId ?? "") ?? [];
  const summary = warehouseSummary(rows);
  const filtered = filterWarehouseStock(rows, search, stock, category);
  const categories = [
    ...new Set(rows.map((row) => row.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  const details = readWarehouseDescription(warehouse?.description ?? null);
  const directory = props.warehouses.filter(
    (item) =>
      Boolean(item.archived_at) === archived &&
      [
        item.name,
        item.request_objects?.name,
        ...Object.values(readWarehouseDescription(item.description)),
      ]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(search.trim().toLocaleLowerCase("ru")),
  );
  const resetFilters = () => {
    setSearch("");
    setStock("all");
    setCategory("all");
    setLimit(60);
  };
  const choose = (id: string | null) => {
    resetFilters();
    setTab("stock");
    props.onChoose(id);
  };
  const scanButton = (
    <Button variant="outline" onClick={props.onScan}>
      <ScanLine aria-hidden="true" />
      Сканировать
    </Button>
  );
  const state = props.error ? (
    <div className="wh-empty" role="alert">
      <h2>Не удалось загрузить склад</h2>
      <p>{props.error}</p>
      <Button variant="outline" onClick={props.onRetry}>
        Повторить загрузку
      </Button>
    </div>
  ) : props.loading ? (
    <div className="wh-empty" role="status">
      Загрузка склада…
    </div>
  ) : null;

  return (
    <div className="wh-workspace" ref={workspace}>
      {props.warehouseId && (
        <nav className="wh-breadcrumb" aria-label="Навигация по складам">
          <button onClick={() => choose(null)}>
            <ArrowLeft aria-hidden="true" />
            Склады
          </button>
          <span aria-hidden="true">/</span>
          <span>{warehouse?.name ?? "Склад"}</span>
        </nav>
      )}
      <header className="wh-heading">
        <div
          className={`wh-heading-main ${props.warehouseId ? "wh-detail-heading" : ""}`}
        >
          <h1>{props.warehouseId ? (warehouse?.name ?? "Склад") : "Склады"}</h1>
          {warehouse && (
            <div className="wh-tags">
              {warehouse.request_objects?.name && (
                <span className="wh-tag">{warehouse.request_objects.name}</span>
              )}
              {warehouse.archived_at && (
                <span className="wh-tag">В архиве</span>
              )}
            </div>
          )}
          {
            <div
              className="wh-segments"
              role="tablist"
              aria-label="Разделы склада"
            >
              {[
                ["stock", props.warehouseId ? "Остатки" : "Склады"],
                ["objects", "Выдано"],
                ["journal", "Журнал"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  id={`wh-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={
                    props.warehouseId ? "wh-detail-panel" : "wh-panel"
                  }
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => {
                    setTab(id);
                    setSearch("");
                  }}
                  onKeyDown={(event) => {
                    const ids = ["stock", "objects", "journal"];
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : (ids.indexOf(id) +
                              (event.key === "ArrowRight" ? 1 : 2)) %
                            3;
                    setTab(ids[next]);
                    setSearch("");
                    document.getElementById(`wh-tab-${ids[next]}`)?.focus();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        </div>
        <div className="wh-actions">
          {!props.warehouseId ? (
            <>
              {scanButton}
              <Button onClick={props.onAdd}>
                <Plus aria-hidden="true" />
                Добавить склад
              </Button>
            </>
          ) : (
            warehouse && (
              <>
                <Button
                  disabled={!!warehouse.archived_at}
                  onClick={tab === "objects" ? props.onIssue : props.onReceive}
                >
                  <Plus aria-hidden="true" />
                  {tab === "objects" ? "Выдать ТМЦ" : "Добавить ТМЦ"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" aria-label="Действия со складом">
                      Ещё
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="wh-menu">
                    <DropdownMenuItem
                      disabled={!!warehouse.archived_at}
                      onSelect={props.onIssue}
                    >
                      Выдать ТМЦ
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.onEdit(warehouse)}>
                      <Pencil />
                      Редактировать склад
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!!warehouse.archived_at}
                      onSelect={props.onInventory}
                    >
                      <ClipboardCheck />
                      Инвентаризация
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!filtered.length || props.labelsBusy}
                      onSelect={() =>
                        props.onLabels(
                          filtered.slice(0, 200).map((row) => row.unit),
                        )
                      }
                    >
                      <QrCode />
                      QR-наклейки · до 200
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setTab(tab === "journal" ? "stock" : "journal")
                      }
                    >
                      Журнал склада
                    </DropdownMenuItem>
                    {props.canArchive && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => props.onArchive(warehouse)}
                        >
                          <Archive />
                          {warehouse.archived_at
                            ? "Вернуть из архива"
                            : "Перенести в архив"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          )}
        </div>
      </header>

      {state ??
        (!props.warehouseId ? (
          <section
            id="wh-panel"
            role="tabpanel"
            aria-labelledby={`wh-tab-${tab}`}
          >
            {tab === "objects" ? (
              props.issued
            ) : tab === "journal" ? (
              <div className="wh-surface wh-existing-view">{props.journal}</div>
            ) : (
              <>
                <div className="wh-directory-tools">
                  <label className="wh-search">
                    <Search aria-hidden="true" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      aria-label="Найти склад"
                      placeholder="Найти склад"
                    />
                  </label>
                  {props.warehouses.some((item) => item.archived_at) && (
                    <button
                      className="wh-archive-toggle"
                      aria-pressed={archived}
                      onClick={() => setArchived(!archived)}
                    >
                      <Archive aria-hidden="true" />
                      {archived ? "Показать действующие" : "Архив складов"}
                    </button>
                  )}
                </div>
                <div className="wh-surface">
                  <table className="wh-table wh-directory">
                    <caption className="sr-only">
                      {archived ? "Архив складов" : "Действующие склады"}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Склад</th>
                        <th scope="col">Расположение</th>
                        <th scope="col">Ответственный</th>
                        <th scope="col" className="wh-center">
                          Позиций · Мало
                        </th>
                        <th scope="col">
                          <span className="sr-only">Открыть</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {directory.map((item) => {
                        const contact = readWarehouseDescription(
                          item.description,
                        );
                        const totals = warehouseSummary(
                          rowsByWarehouse.get(item.id) ?? [],
                        );
                        return (
                          <tr key={item.id}>
                            <td className="wh-name">
                              <button
                                className="wh-name-button"
                                onClick={() => choose(item.id)}
                              >
                                {item.name}
                              </button>
                              {item.request_objects?.name && (
                                <span className="wh-secondary">
                                  {item.request_objects.name}
                                </span>
                              )}
                            </td>
                            <td
                              className="wh-location"
                              data-label="Расположение"
                              data-empty={!contact.address}
                            >
                              {contact.address || "—"}
                            </td>
                            <td className="wh-owner" data-label="Ответственный">
                              <Responsible name={contact.responsible} />
                            </td>
                            <td
                              className="wh-count wh-center"
                              data-label="Позиций · Мало"
                            >
                              <span>{totals.positions}</span>
                              <span className="wh-muted"> · </span>
                              <span
                                className={
                                  totals.low ? "wh-low-number" : "wh-muted"
                                }
                              >
                                {totals.low}
                              </span>
                            </td>
                            <td className="wh-open">
                              <button
                                className="wh-icon-button"
                                aria-label={`Открыть склад ${item.name}`}
                                onClick={() => choose(item.id)}
                              >
                                <ChevronRight aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!directory.length && (
                    <div className="wh-empty">
                      <h2>
                        {search
                          ? "Склады не найдены"
                          : archived
                            ? "В архиве нет складов"
                            : "Пока нет складов"}
                      </h2>
                      {search ? (
                        <Button variant="outline" onClick={() => setSearch("")}>
                          Очистить поиск
                        </Button>
                      ) : (
                        !archived && (
                          <Button onClick={props.onAdd}>
                            <Plus aria-hidden="true" />
                            Добавить склад
                          </Button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        ) : !warehouse ? (
          <div className="wh-empty">
            <h2>Склад не найден или недоступен</h2>
            <Button variant="outline" onClick={() => choose(null)}>
              К списку складов
            </Button>
          </div>
        ) : (
          <section
            id="wh-detail-panel"
            role="tabpanel"
            aria-labelledby={`wh-tab-${tab}`}
          >
            {warehouse.archived_at && (
              <p className="wh-notice">
                Склад в архиве. Доступны остатки и история операций.
              </p>
            )}
            {tab === "stock" && (
              <div className="wh-metrics">
                <div className="wh-metric">
                  <span>Позиций</span>
                  <strong>{summary.positions}</strong>
                </div>
                <div className="wh-metric">
                  <span>Всего единиц</span>
                  <strong className="wh-total">
                    {summary.amounts.length
                      ? summary.amounts.map(([unit, quantity]) => (
                          <span key={unit}>
                            {fmtQty(quantity)} <small>{unit}</small>
                          </span>
                        ))
                      : "0"}
                  </strong>
                </div>
                <button
                  className="wh-metric wh-low-metric"
                  aria-pressed={stock === "low"}
                  onClick={() => {
                    setStock(stock === "low" ? "all" : "low");
                    setLimit(60);
                  }}
                >
                  <span>Мало на складе</span>
                  <strong>{summary.low}</strong>
                </button>
                <div className="wh-metric wh-responsible">
                  <span>Ответственный</span>
                  <strong>{details.responsible || "Не назначен"}</strong>
                </div>
              </div>
            )}
            {tab === "objects" ? (
              props.issued
            ) : tab === "journal" ? (
              <div className="wh-surface wh-existing-view">
                <div className="wh-journal-heading">
                  <h2>Журнал склада</h2>
                  <Button variant="outline" onClick={() => setTab("stock")}>
                    К остаткам
                  </Button>
                </div>
                {props.journal}
              </div>
            ) : (
              <>
                <div className="wh-toolbar">
                  <label className="wh-search">
                    <Search aria-hidden="true" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setLimit(60);
                      }}
                      aria-label="Поиск ТМЦ"
                      placeholder="Название, артикул или QR-код"
                    />
                  </label>
                  {scanButton}
                  <select
                    aria-label="Статус остатка"
                    value={stock}
                    onChange={(event) => {
                      setStock(event.target.value);
                      setLimit(60);
                    }}
                  >
                    <option value="all">Остаток · все</option>
                    <option value="low">Мало на складе</option>
                    <option value="normal">Норма</option>
                    <option value="unknown">Без порога</option>
                  </select>
                  <select
                    aria-label="Категория ТМЦ"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setLimit(60);
                    }}
                  >
                    <option value="all">Категория · все</option>
                    {categories.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="wh-surface">
                  <table className="wh-table wh-stock-table">
                    <caption className="sr-only">
                      ТМЦ на складе {warehouse.name}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Название</th>
                        <th scope="col">Заявка</th>
                        <th scope="col" className="wh-quantity">
                          Количество
                        </th>
                        <th scope="col" className="wh-center">
                          Остаток
                        </th>
                        <th scope="col">
                          <span className="sr-only">QR и наклейки</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, limit).map((row) => (
                        <tr key={row.unit.id}>
                          <td className="wh-name">
                            <button
                              className="wh-name-button"
                              onClick={() => props.onUnit(row.unit)}
                            >
                              {row.unit.name}
                            </button>
                            {[
                              row.article,
                              row.unit.serial_number || row.unit.batch_number,
                            ].filter(Boolean).length > 0 && (
                              <span className="wh-secondary">
                                {[
                                  row.article,
                                  row.unit.serial_number ||
                                    row.unit.batch_number,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </td>
                          <td className="wh-request" data-label="Заявка">
                            {row.unit.source_request_id ? (
                              <Link
                                title={row.unit.request_title ?? undefined}
                                to={`/requests?request=${encodeURIComponent(row.unit.source_request_id)}`}
                              >
                                {row.unit.request_title ||
                                  "Открыть заявку"}
                              </Link>
                            ) : (
                              <span className="wh-muted">Ручная приёмка</span>
                            )}
                          </td>
                          <td className="wh-quantity" data-label="Количество">
                            <strong>{fmtQty(row.quantity)}</strong>
                            <span className="wh-muted"> {row.unit.unit}</span>
                          </td>
                          <td
                            className="wh-badge wh-center"
                            data-label="Остаток"
                          >
                            <StockBadge row={row} />
                          </td>
                          <td className="wh-row-actions">
                            <button
                              className="wh-icon-button"
                              aria-label={`QR-карточка ${row.unit.name}`}
                              title="QR-карточка"
                              onClick={() => props.onUnit(row.unit)}
                            >
                              <QrCode aria-hidden="true" />
                            </button>
                            <button
                              className="wh-icon-button"
                              disabled={props.labelsBusy}
                              aria-label={`Сохранить наклейку ${row.unit.name}`}
                              title="Наклейка PNG"
                              onClick={() => props.onLabels([row.unit])}
                            >
                              <Download aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <div className="wh-empty">
                      <h2>{rows.length ? "ТМЦ не найдены" : "Пока нет ТМЦ"}</h2>
                      {rows.length ? (
                        <Button variant="outline" onClick={resetFilters}>
                          Сбросить фильтры
                        </Button>
                      ) : (
                        <Button
                          disabled={!!warehouse.archived_at}
                          onClick={props.onReceive}
                        >
                          <Plus aria-hidden="true" />
                          Добавить ТМЦ
                        </Button>
                      )}
                    </div>
                  )}
                  {filtered.length > limit && (
                    <div className="wh-table-footer">
                      <span className="wh-muted">
                        Показано {Math.min(limit, filtered.length)} из{" "}
                        {filtered.length}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setLimit(limit + 60)}
                      >
                        Показать ещё
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        ))}
    </div>
  );
}
