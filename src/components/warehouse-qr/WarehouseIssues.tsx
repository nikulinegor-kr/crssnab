import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueDate, filterIssues } from "@/lib/objectIssues";
import {
  fmtQty,
  issueSplit,
  issueGroup,
  totalsByUnit,
  type IssueGroup,
} from "@/lib/issueStatus";
import type { ActionIssue } from "./IssueActionsDialog";

export interface IssueDisplayRow extends ActionIssue {
  unitName: string;
  unit: string;
  targetName: string;
  warehouseName: string;
}
interface Props {
  rows: IssueDisplayRow[];
  onAction: (row: IssueDisplayRow, initial: "return" | "consume") => void;
  scoped?: boolean;
}
const GROUPS = {
  employee: "По сотрудникам",
  object: "По объектам",
  equipment: "По технике",
};
const STATUS = {
  all: "Все выдачи",
  outstanding: "Числится",
  consumed: "Есть списание",
  returned: "Есть возврат",
};
function stateOf(row: IssueDisplayRow) {
  const split = issueSplit(row);
  if (split.outstanding > 0) return { name: "Числится", className: "normal" };
  if (split.consumed === split.issued)
    return { name: "Списано", className: "consumed" };
  if (split.returned === split.issued)
    return { name: "Возвращено", className: "returned" };
  if (split.installed === split.issued)
    return { name: "Установлено", className: "returned" };
  return { name: "Закрыто", className: "returned" };
}
export function WarehouseIssues({ rows, onAction, scoped = false }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<keyof typeof STATUS>("all");
  const [group, setGroup] = useState<"all" | IssueGroup>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(60);
  const filtered = useMemo(
    () =>
      filterIssues(rows, {
        from,
        to,
        search,
        text: (row) => {
          const item = row as IssueDisplayRow;
          return [
            item.unitName,
            item.recipient_name,
            item.targetName,
            item.warehouseName,
            item.note,
          ].join(" ");
        },
      }).filter((row) => {
        const split = issueSplit(row);
        return (
          status === "all" ||
          (status === "consumed"
            ? split.consumed > 0
            : status === "returned"
              ? split.returned > 0
              : split.outstanding > 0)
        );
      }) as IssueDisplayRow[],
    [rows, search, from, to, status],
  );
  const groups = useMemo(() => {
    if (group === "all") return [];
    const result = new Map<
      string,
      { id: string; name: string; rows: IssueDisplayRow[] }
    >();
    for (const row of filtered) {
      const target = issueGroup(row);
      if (target.group !== group) continue;
      const item = result.get(target.id) ?? {
        id: target.id,
        name: group === "employee" ? row.recipient_name : row.targetName,
        rows: [],
      };
      item.rows.push(row);
      result.set(target.id, item);
    }
    return [...result.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "ru"),
    );
  }, [filtered, group]);
  const selectedGroup = groups.find((item) => item.id === selected);
  const displayRows = group === "all" ? filtered : (selectedGroup?.rows ?? []);
  const totals = totalsByUnit(
    filtered.map((row) => ({ unit: row.unit, split: issueSplit(row) })),
  );
  const amounts = (key: "outstanding" | "consumed" | "returned") =>
    totals
      .filter((total) => total[key] > 0)
      .map((total) => `${fmtQty(total[key])} ${total.unit}`)
      .join(" · ") || "0";
  const reset = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setStatus("all");
    setLimit(60);
  };

  return (
    <div className="wh-issued">
      <div className="wh-metrics wh-issued-metrics">
        <div className="wh-metric">
          <span>Всего выдач</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="wh-metric">
          <span>Числится</span>
          <strong>{amounts("outstanding")}</strong>
        </div>
        <div className="wh-metric">
          <span>Списано в расход</span>
          <strong>{amounts("consumed")}</strong>
        </div>
        <div className="wh-metric">
          <span>Возвращено</span>
          <strong>{amounts("returned")}</strong>
        </div>
      </div>
      <div className="wh-issued-tools">
        <label className="wh-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Поиск выдач"
            placeholder="ТМЦ, получатель или назначение"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(60);
            }}
          />
        </label>
        <select
          aria-label="Состояние выдач"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as keyof typeof STATUS);
            setLimit(60);
          }}
        >
          {Object.entries(STATUS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Группировка выдач"
          value={group}
          onChange={(event) => {
            setGroup(event.target.value as typeof group);
            setSelected(null);
            setLimit(60);
          }}
        >
          <option value="all">Без группировки</option>
          {Object.entries(GROUPS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="wh-issued-dates">
        <label>
          <span>С даты</span>
          <Input
            type="date"
            aria-label="С даты выдачи"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setLimit(60);
            }}
          />
        </label>
        <label>
          <span>По дату</span>
          <Input
            type="date"
            aria-label="По дату выдачи"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setLimit(60);
            }}
          />
        </label>
        {(search || from || to || status !== "all") && (
          <Button variant="ghost" onClick={reset}>
            Сбросить фильтры
          </Button>
        )}
      </div>
      {group !== "all" && !selected ? (
        <div className="wh-surface wh-issued-groups">
          {groups.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                setLimit(60);
              }}
            >
              <span>
                <strong>{item.name}</strong>
                <small>{item.rows.length} выдач</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </button>
          ))}
          {!groups.length && <div className="wh-empty">Выдачи не найдены</div>}
        </div>
      ) : (
        <>
          {selected && (
            <div className="wh-issued-subheading">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                <ArrowLeft aria-hidden="true" />
                Назад
              </Button>
              <h2>{selectedGroup?.name || "Выдачи"}</h2>
            </div>
          )}
          <div className="wh-surface">
            <table className="wh-table wh-issued-table">
              <caption className="sr-only">Выдачи со склада</caption>
              <thead>
                <tr>
                  <th scope="col">ТМЦ / Дата</th>
                  <th scope="col">Получатель</th>
                  <th scope="col">Учёт</th>
                  <th scope="col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.slice(0, limit).map((row) => {
                  const split = issueSplit(row);
                  const state = stateOf(row);
                  return (
                    <tr key={row.id}>
                      <td className="wh-issued-name">
                        <button
                          className="wh-name-button"
                          onClick={() => onAction(row, "return")}
                        >
                          {row.unitName}
                        </button>
                        <span className="wh-secondary">
                          {issueDate(row).split("-").reverse().join(".")} ·
                          выдано {fmtQty(split.issued)} {row.unit}
                        </span>
                        {!scoped && (
                          <span className="wh-secondary">
                            {row.warehouseName}
                          </span>
                        )}
                      </td>
                      <td className="wh-issued-person" data-label="Получатель">
                        <strong>{row.recipient_name}</strong>
                        {row.targetName && (
                          <span className="wh-secondary">{row.targetName}</span>
                        )}
                        <span className="wh-secondary">
                          {row.received_confirmed_at
                            ? "Получение подтверждено"
                            : "Ожидает подтверждения"}
                        </span>
                        {row.note && (
                          <span className="wh-secondary">{row.note}</span>
                        )}
                      </td>
                      <td className="wh-issued-state" data-label="Учёт">
                        <span
                          className={`wh-stock wh-issue-${state.className}`}
                        >
                          {state.name}
                        </span>
                        <span className="wh-secondary">
                          Числится {fmtQty(split.outstanding)} {row.unit}
                        </span>
                        {split.consumed > 0 && (
                          <span className="wh-secondary">
                            Списано {fmtQty(split.consumed)} {row.unit}
                          </span>
                        )}
                        {split.returned > 0 && (
                          <span className="wh-secondary">
                            Возвращено {fmtQty(split.returned)} {row.unit}
                          </span>
                        )}
                        {split.installed > 0 && (
                          <span className="wh-secondary">
                            Установлено {fmtQty(split.installed)} {row.unit}
                          </span>
                        )}
                      </td>
                      <td className="wh-issued-actions">
                        {split.outstanding > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => onAction(row, "consume")}
                          >
                            Списать
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => onAction(row, "return")}
                        >
                          Подробнее
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!displayRows.length && (
              <div className="wh-empty">
                <h2>{rows.length ? "Выдачи не найдены" : "Пока нет выдач"}</h2>
                <p>
                  {rows.length
                    ? "Измените период или условия поиска."
                    : "Нажмите «Выдать ТМЦ», чтобы оформить первую выдачу."}
                </p>
              </div>
            )}
            {displayRows.length > limit && (
              <div className="wh-table-footer">
                <span>
                  Показано {limit} из {displayRows.length}
                </span>
                <Button variant="outline" onClick={() => setLimit(limit + 60)}>
                  Показать ещё
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
