import { FileSpreadsheet, Check, Loader2, AlertTriangle, Pencil, Lock, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback, useRef } from "react";
import { ReportHeader } from "@/components/agent-report/ReportHeader";
import { ReportTable } from "@/components/agent-report/ReportTable";
import { ExportReportButton } from "@/components/agent-report/ExportReportButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Button } from "@/components/ui/button";
import { Request } from "@/hooks/useRequests";
import { Plus } from "lucide-react";
import { ActCalculationTable } from "@/components/agent-act-report/ActCalculationTable";
import { ActAdditionalTable } from "@/components/agent-act-report/ActAdditionalTable";
import { ExportActReportButton } from "@/components/agent-act-report/ExportActReportButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ReceiptManager, type RecognizedReceipt } from "@/components/agent-act-report/ReceiptManager";

const defaultHeader = {
  report_number: "1",
  contract_number: "1-21",
  contract_date: "2021-05-28",
  period_start: "2024-12-01",
  period_end: "2024-12-31",
  company_name: "ООО «САХАРЕСУРС»",
  company_address: "Республика Саха (Якутия), г. Нерюнгри, пос. Серебряный Бор, д. 401",
  company_phone: "тел./факс: +7 (4147) 6-46-62",
  recipient_name: "Переведенцев М.Л.",
  recipient_position: "Генеральный директор ООО«САХАРЕСУРС»"
};

const months = [
  { value: 1, label: "Январь" }, { value: 2, label: "Февраль" },
  { value: 3, label: "Март" }, { value: 4, label: "Апрель" },
  { value: 5, label: "Май" }, { value: 6, label: "Июнь" },
  { value: 7, label: "Июль" }, { value: 8, label: "Август" },
  { value: 9, label: "Сентябрь" }, { value: 10, label: "Октябрь" },
  { value: 11, label: "Ноябрь" }, { value: 12, label: "Декабрь" },
];

interface CalculationRow {
  id: string;
  row_number: number;
  transfer_date: string | null;
  transferred_amount: number | null;
  tax_7_percent: number | null;
  remainder_after_tax: number | null;
  salary_with_commission: number | null;
  check_amount: number | null;
  act_amount: number | null;
  formula: string | null;
}

interface AdditionalRow {
  id: string;
  row_number: number;
  description: string | null;
  amount: number | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SelectionInfo {
  totalBeforeAdjust: number;
  adjustedRowIndex: number | null;
  adjustmentDelta: number;
  selectedCount: number;
  totalCount: number;
  error: string | null;
}

const AgentReport = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [activeTab, setActiveTab] = useState("uu");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  // === Report (Отчет агента) state ===
  const [reportId, setReportId] = useState<string | null>(null);
  const [headerData, setHeaderData] = useState({ ...defaultHeader });
  const [rows, setRows] = useState<any[]>([]);

  // === UU Report (Отчет агента - УУ) state ===
  const [uuReportId, setUuReportId] = useState<string | null>(null);
  const [uuHeaderData, setUuHeaderData] = useState({ ...defaultHeader });
  const [uuRows, setUuRows] = useState<any[]>([]);

  // === Act Report (Отчет по акту) state ===
  const [actReportId, setActReportId] = useState<string | null>(null);
  const [calculationRows, setCalculationRows] = useState<CalculationRow[]>([]);
  const [additionalRows, setAdditionalRows] = useState<AdditionalRow[]>([]);
  const [receipts, setReceipts] = useState<RecognizedReceipt[]>([]);
  const [agentCommission, setAgentCommission] = useState(0);
  const [reportEditMode, setReportEditMode] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // Refs to track if initial load is done (to avoid auto-save on load)
  const initialLoadDone = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-update period when month/year changes
  useEffect(() => {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const mm = String(selectedMonth).padStart(2, '0');
    const periodUpdate = {
      period_start: `${selectedYear}-${mm}-01`,
      period_end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      report_number: selectedMonth.toString(),
    };
    setHeaderData(prev => ({ ...prev, ...periodUpdate }));
    setUuHeaderData(prev => ({ ...prev, ...periodUpdate }));
  }, [selectedMonth, selectedYear]);

  // Load all reports when month/year/org changes
  useEffect(() => {
    if (currentOrgId) {
      initialLoadDone.current = false;
      loadAllData();
    }
  }, [selectedMonth, selectedYear, currentOrgId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadReport(),
        loadUuReport(),
        loadActReport(),
      ]);
    } finally {
      setLoading(false);
      // Small delay to avoid triggering auto-save from initial load state changes
      setTimeout(() => { initialLoadDone.current = true; }, 500);
    }
  };

  // ========== AUTO-SAVE DEBOUNCE ==========
  const triggerAutoSave = useCallback((saveFn: () => Promise<void>) => {
    if (!initialLoadDone.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveFn();
        setSaveStatus("saved");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaveStatus("error");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 5000);
      }
    }, 1000);
  }, []);

  // ========== SHARED: Load data from requests ==========
  const loadDataFromRequests = useCallback(async () => {
    if (!currentOrgId) return [];
    const { data: requests, error } = await supabase
      .from("requests").select("*")
      .eq("organization_id", currentOrgId)
      .order("request_date", { ascending: false });
    if (error) throw error;

    const matchesMonth = (dateStr: string | null) => {
      if (!dateStr) return false;
      const [y, m] = dateStr.split("-");
      return y === selectedYear.toString() && String(parseInt(m, 10)) === selectedMonth.toString();
    };

    const ALLOWED_STATUSES = new Set(["В пути", "Доставлено"]);
    const totalAmount = (r: any) =>
      Number(r.amount || 0) + Number(r.amount_2 || 0) + Number(r.amount_3 || 0);
    const invoicesJoined = (r: any) =>
      [r.invoice_number, r.invoice_number_2, r.invoice_number_3]
        .filter((v) => v && String(v).trim().length > 0)
        .join(", ");

    const filtered = (requests || []).filter((r: Request) => {
      if (totalAmount(r) <= 0) return false;
      if (!ALLOWED_STATUSES.has((r as any).status)) return false;
      const contractor = ((r as any).contractor || "").trim();
      if (contractor.includes("ИП Никулин") || contractor.includes("Никулин Е.В")) return false;
      return matchesMonth(r.delivery_date) || matchesMonth(r.shipment_date);
    });

    return filtered.map((req: Request, index: number) => ({
      row_number: index + 1,
      tmc: req.description || "",
      contractor: req.contractor || "",
      invoice_number: invoicesJoined(req) || req.invoice_number || "",
      amount: totalAmount(req),
    }));
  }, [currentOrgId, selectedMonth, selectedYear]);

  // ========== PERSIST HELPERS ==========
  const ensureReportId = async (
    table: string,
    currentId: string | null,
    setId: (id: string) => void,
    headerForInsert?: Record<string, any>
  ): Promise<string> => {
    if (currentId) return currentId;
    if (!currentOrgId) throw new Error("No org");

    const insertData: any = {
      organization_id: currentOrgId,
      month: selectedMonth,
      year: selectedYear,
    };

    if (headerForInsert) {
      Object.assign(insertData, headerForInsert);
      insertData.created_by = (await supabase.auth.getUser()).data.user?.id;
    }

    const { data, error } = await supabase
      .from(table as any).insert(insertData).select().single();
    if (error) throw error;
    setId((data as any).id);
    return (data as any).id;
  };

  const persistRows = async (
    table: string,
    reportIdVal: string,
    rowsData: any[],
  ) => {
    // Delete all existing rows, re-insert
    await (supabase.from(table as any) as any).delete().eq("report_id", reportIdVal);
    if (rowsData.length > 0) {
      const { error } = await (supabase.from(table as any) as any).insert(
        rowsData.map(r => {
          const { id, formula, ...rest } = r;
          return {
            ...rest,
            report_id: reportIdVal,
            amount: typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0,
          };
        })
      );
      if (error) throw error;
    }
  };

  // ========== GREEDY ALGORITHM: Auto-generate "Отчет агента" ==========
  const getActTotal = useCallback(() => {
    if (calculationRows.length === 0) {
      const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      const salaryTotal = 30000 + agentCommission;
      const remainder = salaryTotal + checkAmountTotal;
      return parseFloat(((remainder / 93) * 100).toFixed(2));
    }

    return calculationRows.reduce((sum, r) => sum + (r.act_amount || 0), 0);
  }, [additionalRows, agentCommission, calculationRows]);

  const generateReportRows = useCallback((sourceRows: any[], targetActAmount: number): { rows: any[]; info: SelectionInfo } => {
    // 1. Filter out "ИП Никулин Е.В."
    const filtered = sourceRows.filter(r => {
      const contractor = (r.contractor || "").trim();
      return !contractor.includes("ИП Никулин") && !contractor.includes("Никулин Е.В");
    });

    const emptyInfo: SelectionInfo = { totalBeforeAdjust: 0, adjustedRowIndex: null, adjustmentDelta: 0, selectedCount: 0, totalCount: filtered.length, error: null };

    if (filtered.length === 0 || targetActAmount <= 0) {
      return { rows: [], info: { ...emptyInfo, error: filtered.length === 0 ? "Нет доступных строк (все исключены)" : null } };
    }

    // Convert amounts to integers (kopecks) for exact arithmetic
    const items = filtered.map((r, idx) => ({
      originalIndex: idx,
      row: r,
      amount: Math.round((typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0) * 100),
    })).filter(item => item.amount > 0);

    const targetKopecks = Math.round(targetActAmount * 100);
    const totalAvailable = items.reduce((s, it) => s + it.amount, 0);

    // PRE-CHECK: log values
    console.log("[AgentReport] Подбор строк:", {
      целевая_сумма: targetActAmount,
      доступных_строк: items.length,
      сумма_доступных: totalAvailable / 100,
    });

    // PRE-CHECK: if total available < target, cannot build report
    if (totalAvailable < targetKopecks) {
      const err = `Недостаточно сумм для формирования отчёта. Доступно: ${(totalAvailable / 100).toFixed(2)} ₽, требуется: ${targetActAmount.toFixed(2)} ₽`;
      console.warn("[AgentReport]", err);
      return { rows: [], info: { ...emptyInfo, error: err } };
    }

    // 2. Subset-sum: find subset with sum closest to target but NOT exceeding it
    let bestSubset: number[] = [];
    let bestSum = 0;

    if (items.length <= 20) {
      // DP with array-based tracking (safe for ≤20 items)
      // dp[sum] = array of item indices
      const dp = new Map<number, number[]>();
      dp.set(0, []);

      for (let i = 0; i < items.length; i++) {
        const amt = items[i].amount;
        // Process existing entries (snapshot to avoid mutation during iteration)
        const entries = Array.from(dp.entries());
        for (const [sum, indices] of entries) {
          const newSum = sum + amt;
          // STRICT: never exceed target
          if (newSum > targetKopecks) continue;
          if (!dp.has(newSum) || newSum > bestSum) {
            dp.set(newSum, [...indices, i]);
          }
        }
      }

      // Find best (closest to target, never exceeding)
      for (const [sum, indices] of dp.entries()) {
        if (sum <= targetKopecks && sum > bestSum) {
          bestSum = sum;
          bestSubset = indices;
        }
      }
    } else {
      // Greedy + local search for larger sets
      const sorted = items.map((item, i) => ({ ...item, sortIdx: i })).sort((a, b) => b.amount - a.amount);
      let currentSum = 0;
      const selectedSet = new Set<number>();

      for (const item of sorted) {
        if (currentSum + item.amount <= targetKopecks) {
          selectedSet.add(item.sortIdx);
          currentSum += item.amount;
        }
      }

      // Local search: try swaps to get closer
      let improved = true;
      while (improved) {
        improved = false;
        for (let i = 0; i < items.length; i++) {
          if (selectedSet.has(i)) continue;
          for (const j of Array.from(selectedSet)) {
            const newSum = currentSum - items[j].amount + items[i].amount;
            if (newSum <= targetKopecks && newSum > currentSum) {
              selectedSet.delete(j);
              selectedSet.add(i);
              currentSum = newSum;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }

      // Try adding any remaining items
      for (let i = 0; i < items.length; i++) {
        if (!selectedSet.has(i) && currentSum + items[i].amount <= targetKopecks) {
          selectedSet.add(i);
          currentSum += items[i].amount;
        }
      }

      bestSum = currentSum;
      bestSubset = Array.from(selectedSet);
    }

    // 3. Build selected rows
    const selected = bestSubset.map(i => ({ ...items[i].row, _adjusted: false, _originalAmount: items[i].amount / 100 }));
    const totalBeforeAdjust = bestSum / 100;

    console.log("[AgentReport] Результат подбора:", {
      выбрано_строк: selected.length,
      сумма_выбранных: totalBeforeAdjust,
      целевая: targetActAmount,
      разница: parseFloat((targetActAmount - totalBeforeAdjust).toFixed(2)),
    });

    // 4. Calculate difference and apply adjustment if within threshold
    const diff = parseFloat((targetActAmount - totalBeforeAdjust).toFixed(2));
    const diffPercent = totalBeforeAdjust > 0 ? Math.abs(diff / totalBeforeAdjust) * 100 : 100;

    let adjustedRowIndex: number | null = null;
    let adjustmentDelta = 0;
    let error: string | null = null;

    if (Math.abs(diff) > 0.005 && selected.length > 0) {
      if (diffPercent <= 2) {
        // Adjust the row with the largest amount
        const maxIdx = selected.reduce((best, r, i) => (r._originalAmount || 0) > (selected[best]._originalAmount || 0) ? i : best, 0);
        const newAmount = parseFloat(((selected[maxIdx]._originalAmount || 0) + diff).toFixed(2));
        if (newAmount > 0) {
          adjustedRowIndex = maxIdx;
          adjustmentDelta = diff;
          selected[maxIdx] = { ...selected[maxIdx], amount: newAmount, _adjusted: true };
        } else {
          error = `Невозможно корректно собрать отчёт — корректировка приводит к отрицательной сумме. Проверьте данные.`;
        }
      } else {
        error = `Невозможно корректно собрать отчёт — разница ${Math.abs(diff).toFixed(2)} ₽ (${diffPercent.toFixed(1)}%) превышает допустимый порог 2%. Проверьте данные.`;
      }
    }

    // POST-CHECK: verify final sum
    const finalSum = selected.reduce((s, r) => s + (typeof r.amount === 'number' ? r.amount : 0), 0);
    const finalDiff = Math.abs(finalSum - targetActAmount);
    if (finalDiff > 0.01 && !error) {
      error = `Расчёт некорректен: итого ${finalSum.toFixed(2)} ₽ ≠ цель ${targetActAmount.toFixed(2)} ₽. Проверьте данные.`;
      console.error("[AgentReport] POST-CHECK FAILED:", { finalSum, targetActAmount, finalDiff });
    }

    console.log("[AgentReport] Финальная проверка:", {
      итого: finalSum.toFixed(2),
      цель: targetActAmount.toFixed(2),
      ок: finalDiff <= 0.01,
    });

    // Re-number
    const result = selected.map((r, i) => ({ ...r, row_number: i + 1 }));

    return {
      rows: result,
      info: {
        totalBeforeAdjust,
        adjustedRowIndex,
        adjustmentDelta,
        selectedCount: selected.length,
        totalCount: filtered.length,
        error,
      },
    };
  }, []);

  // ========== REPORT (Отчет агента) ==========
  const loadReport = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData, error } = await supabase
        .from("agent_report_data").select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;

      if (reportData) {
        setReportId(reportData.id);
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const mm = String(selectedMonth).padStart(2, '0');
        setHeaderData({
          report_number: reportData.report_number,
          contract_number: reportData.contract_number,
          contract_date: reportData.contract_date,
          period_start: `${selectedYear}-${mm}-01`,
          period_end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
          company_name: reportData.company_name,
          company_address: reportData.company_address || "",
          company_phone: reportData.company_phone || "",
          recipient_name: reportData.recipient_name || "",
          recipient_position: reportData.recipient_position || ""
        });
        const { data: rowsData, error: rowsError } = await supabase
          .from("agent_report_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        if (rowsError) throw rowsError;
        setRows(rowsData?.map(r => ({
          id: r.id, row_number: r.row_number, tmc: r.tmc || "",
          contractor: r.contractor || "", invoice_number: r.invoice_number || "",
          amount: r.amount || 0, formula: r.formula || undefined
        })) || []);
      } else {
        setReportId(null);
        setRows([]);
      }
    } catch (error) {
      console.error("Error loading report:", error);
    }
  };

  const saveReportNow = async () => {
    if (!currentOrgId) return;
    const id = await ensureReportId("agent_report_data", reportId, setReportId, headerData);
    await supabase.from("agent_report_data")
      .update({ ...headerData, month: selectedMonth, year: selectedYear }).eq("id", id);
    await persistRows("agent_report_rows", id, rows);
  };

  // ========== UU REPORT (Отчет агента - УУ) ==========
  const loadUuReport = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData, error } = await supabase
        .from("agent_report_uu_data").select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;

      if (reportData) {
        setUuReportId(reportData.id);
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const mm = String(selectedMonth).padStart(2, '0');
        setUuHeaderData({
          report_number: reportData.report_number,
          contract_number: reportData.contract_number,
          contract_date: reportData.contract_date,
          period_start: `${selectedYear}-${mm}-01`,
          period_end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
          company_name: reportData.company_name,
          company_address: reportData.company_address || "",
          company_phone: reportData.company_phone || "",
          recipient_name: reportData.recipient_name || "",
          recipient_position: reportData.recipient_position || ""
        });
        const { data: rowsData, error: rowsError } = await supabase
          .from("agent_report_uu_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        if (rowsError) throw rowsError;
        const existingRaw = rowsData?.map(r => ({
          id: r.id, row_number: r.row_number, tmc: r.tmc || "",
          contractor: r.contractor || "", invoice_number: r.invoice_number || "",
          amount: r.amount || 0, formula: r.formula || undefined
        })) || [];

        // === AUTO-CLEANUP: убираем строки, у которых связанная заявка
        // больше не имеет статус "В пути" или "Доставлено" ===
        const ALLOWED_STATUSES = new Set(["В пути", "Доставлено"]);
        const normInv = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
        const invoiceNumbers = existingRaw
          .map(r => r.invoice_number)
          .filter(Boolean) as string[];
        let invalidInvoices = new Set<string>();
        if (invoiceNumbers.length > 0) {
          const { data: linkedReqs } = await supabase
            .from("requests")
            .select("invoice_number, status")
            .eq("organization_id", currentOrgId)
            .in("invoice_number", invoiceNumbers);
          (linkedReqs || []).forEach((r: any) => {
            if (r.invoice_number && !ALLOWED_STATUSES.has(r.status)) {
              invalidInvoices.add(normInv(r.invoice_number));
            }
          });
        }
        const removedCount = existingRaw.filter(r => r.invoice_number && invalidInvoices.has(normInv(r.invoice_number))).length;
        const existing = existingRaw.filter(r => !(r.invoice_number && invalidInvoices.has(normInv(r.invoice_number))));
        if (removedCount > 0) {
          console.log(`[UU Report] Auto-removed ${removedCount} row(s) — request status no longer "В пути"/"Доставлено"`);
        }

        // === MERGE-SYNC: дотягиваем недостающие заявки за период ===
        const fresh = await loadDataFromRequests();
        const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
        const keyOf = (r: any) => {
          const inv = norm(r.invoice_number);
          if (inv) return `inv::${inv}`;
          return `desc::${norm(r.tmc || r.description)}::${norm(r.contractor)}::${Number(r.amount || 0).toFixed(2)}`;
        };
        const existingKeys = new Set(existing.map(keyOf));
        const toAdd = fresh.filter(f => !existingKeys.has(keyOf(f)));

        if (toAdd.length > 0 || removedCount > 0) {
          const merged = [...existing, ...toAdd].map((r, i) => ({ ...r, row_number: i + 1 }));
          setUuRows(merged);
          await persistRows("agent_report_uu_rows", reportData.id, merged);
          const total = merged.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
          setAgentCommission(calculateCommission(total));
          if (toAdd.length > 0) {
            console.log(`[UU Report] Auto-synced ${toAdd.length} new request(s) for ${selectedMonth}/${selectedYear}`);
          }
        } else {
          setUuRows(existing);
        }
      } else {
        // Auto-load from requests and save immediately
        const newRows = await loadDataFromRequests();
        setUuRows(newRows);
        if (newRows.length > 0) {
          const id = await ensureReportId("agent_report_uu_data", null, setUuReportId, uuHeaderData);
          await persistRows("agent_report_uu_rows", id, newRows);
          // Update commission
          const total = newRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
          setAgentCommission(calculateCommission(total));
        }
      }
    } catch (error) {
      console.error("Error loading UU report:", error);
    }
  };

  const saveUuReportNow = async () => {
    if (!currentOrgId) return;
    const id = await ensureReportId("agent_report_uu_data", uuReportId, setUuReportId, uuHeaderData);
    await supabase.from("agent_report_uu_data")
      .update({ ...uuHeaderData, month: selectedMonth, year: selectedYear }).eq("id", id);
    await persistRows("agent_report_uu_rows", id, uuRows);
    // Update commission
    const total = uuRows.reduce((sum: number, r: any) => sum + (typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0), 0);
    setAgentCommission(calculateCommission(total));
  };

  // ========== ACT REPORT (Отчет по акту) ==========
  const calculateCommission = (total: number) => {
    if (total >= 10000000) return 5000000 * 0.02 + 5000000 * 0.01 + (total - 10000000) * 0.01;
    if (total >= 5000000) return 5000000 * 0.02 + (total - 5000000) * 0.01;
    return total * 0.02;
  };

  const loadActReport = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData, error } = await supabase.from("agent_act_report_data").select("*")
        .eq("organization_id", currentOrgId).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;
      if (reportData) {
        setActReportId(reportData.id);
        const { data: calcData } = await supabase.from("agent_act_calculation_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        const { data: addData } = await supabase.from("agent_act_additional_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        const checkAmountTotal = (addData || []).reduce((sum: number, row: any) => sum + (row.amount || 0), 0);
        const processed = (calcData || []).map((row: any) => {
          const p = { ...row };
          if (row.salary_with_commission) {
            p.tax_7_percent = parseFloat((row.salary_with_commission * 0.07).toFixed(2));
            p.remainder_after_tax = parseFloat((row.salary_with_commission + checkAmountTotal).toFixed(2));
            p.act_amount = parseFloat(((p.remainder_after_tax / 93) * 100).toFixed(2));
          }
          return p;
        });
        setCalculationRows(processed);
        setAdditionalRows(addData || []);
      } else {
        setActReportId(null); setCalculationRows([]); setAdditionalRows([]);
      }

      // Load commission from UU report
      const { data: uuData } = await supabase.from("agent_report_uu_data").select("id")
        .eq("organization_id", currentOrgId).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (uuData) {
        const { data: uuRowsData } = await supabase.from("agent_report_uu_rows").select("amount").eq("report_id", uuData.id);
        const total = uuRowsData?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0;
        setAgentCommission(calculateCommission(total));
      } else {
        setAgentCommission(0);
      }
    } catch (error) {
      console.error("Error loading act report:", error);
    }
  };

  const saveActReportNow = async () => {
    if (!currentOrgId) return;
    let id = actReportId;
    if (!id) {
      const { data, error } = await supabase.from("agent_act_report_data")
        .insert({ organization_id: currentOrgId, month: selectedMonth, year: selectedYear }).select().single();
      if (error) throw error;
      id = data.id; setActReportId(id);
    }
    // Save calculation rows
    await supabase.from("agent_act_calculation_rows").delete().eq("report_id", id);
    if (calculationRows.length > 0) {
      const { error } = await supabase.from("agent_act_calculation_rows").insert(
        calculationRows.map(r => {
          const { id: _, ...rest } = r;
          return { ...rest, report_id: id };
        })
      );
      if (error) throw error;
    }
    // Save additional rows
    await supabase.from("agent_act_additional_rows").delete().eq("report_id", id);
    if (additionalRows.length > 0) {
      const { error } = await supabase.from("agent_act_additional_rows").insert(
        additionalRows.map(r => {
          const { id: _, ...rest } = r;
          return { ...rest, report_id: id };
        })
      );
      if (error) throw error;
    }
  };

  // ========== AUTO-GENERATE "Отчет агента" from UU + Act ==========
  const autoGenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialLoadDone.current || !currentOrgId) return;
    if (reportEditMode) return; // Don't auto-generate in edit mode
    if (uuRows.length === 0) return;
    const actTotal = getActTotal();
    if (actTotal <= 0) return;

    // Target ИТОГО such that ИТОГО * 8% = actTotal
    const targetItogo = parseFloat((actTotal / 0.08).toFixed(2));

    if (autoGenRef.current) clearTimeout(autoGenRef.current);
    autoGenRef.current = setTimeout(() => {
      const { rows: generated, info } = generateReportRows(uuRows, targetItogo);
      setSelectionInfo(info);
      // Only update if actually different to avoid infinite loops
      const currentSum = rows.reduce((s, r) => s + (r.amount || 0), 0);
      const newSum = generated.reduce((s: number, r: any) => s + (r.amount || 0), 0);
      if (Math.abs(currentSum - newSum) > 0.001 || rows.length !== generated.length) {
        setRows(generated);
      }
    }, 300);

    return () => { if (autoGenRef.current) clearTimeout(autoGenRef.current); };
  }, [uuRows, getActTotal, generateReportRows, reportEditMode]);

  // ========== AUTO-SAVE TRIGGERS ==========
  // Report auto-save
  useEffect(() => {
    if (!initialLoadDone.current || !currentOrgId) return;
    triggerAutoSave(saveReportNow);
  }, [rows, headerData]);

  // UU Report auto-save
  useEffect(() => {
    if (!initialLoadDone.current || !currentOrgId) return;
    triggerAutoSave(saveUuReportNow);
  }, [uuRows, uuHeaderData]);

  // Act Report auto-save
  useEffect(() => {
    if (!initialLoadDone.current || !currentOrgId) return;
    triggerAutoSave(saveActReportNow);
  }, [calculationRows, additionalRows]);

  // ========== ACT REPORT HANDLERS ==========
  const addCalculationRow = () => {
    const baseSalary = 30000 + agentCommission;
    const checkAmountTotal = additionalRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const remainder = baseSalary + checkAmountTotal;
    setCalculationRows([...calculationRows, {
      id: `new-${Date.now()}`, row_number: calculationRows.length + 1,
      transfer_date: null, transferred_amount: null,
      tax_7_percent: parseFloat((baseSalary * 0.07).toFixed(2)),
      remainder_after_tax: parseFloat(remainder.toFixed(2)),
      salary_with_commission: baseSalary, check_amount: null,
      act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)), formula: null,
    }]);
  };

  const addAdditionalRow = () => {
    setAdditionalRows([...additionalRows, {
      id: `new-${Date.now()}`, row_number: additionalRows.length + 1,
      description: null, amount: null,
    }]);
  };

  const deleteCalculationRow = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("agent_act_calculation_rows").delete().eq("id", id);
    setCalculationRows(calculationRows.filter(r => r.id !== id));
  };

  const deleteAdditionalRow = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("agent_act_additional_rows").delete().eq("id", id);
    const updated = additionalRows.filter(r => r.id !== id);
    setAdditionalRows(updated);
    const checkTotal = updated.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (!row.salary_with_commission) return row;
      const remainder = parseFloat((row.salary_with_commission + checkTotal).toFixed(2));
      return { ...row, remainder_after_tax: remainder, act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)) };
    }));
  };

  const updateCalculationRow = (id: string, field: keyof CalculationRow, value: any) => {
    const checkTotal = additionalRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (row.id !== id) return row;
      const u = { ...row, [field]: value };
      if (field === "transferred_amount" && value !== null) u.salary_with_commission = 30000 + agentCommission;
      if (field === "salary_with_commission" && value !== null) {
        u.tax_7_percent = parseFloat((value * 0.07).toFixed(2));
        u.remainder_after_tax = parseFloat((value + checkTotal).toFixed(2));
        u.act_amount = parseFloat(((u.remainder_after_tax / 93) * 100).toFixed(2));
      }
      return u;
    }));
  };

  const updateAdditionalRow = (id: string, field: keyof AdditionalRow, value: any) => {
    const updated = additionalRows.map(r => r.id === id ? { ...r, [field]: value } : r);
    setAdditionalRows(updated);
    const checkTotal = updated.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (!row.salary_with_commission) return row;
      const remainder = parseFloat((row.salary_with_commission + checkTotal).toFixed(2));
      return { ...row, remainder_after_tax: remainder, act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)) };
    }));
  };

  const syncReceiptsToAdditionalRows = useCallback((newReceipts: RecognizedReceipt[]) => {
    setReceipts(newReceipts);
    const grouped: Record<string, number> = {};
    newReceipts
      .filter(r => r.status === "done" && r.amount)
      .forEach(r => { grouped[r.category] = (grouped[r.category] || 0) + (r.amount || 0); });
    const receiptRows: AdditionalRow[] = Object.entries(grouped).map(([cat, amount], idx) => ({
      id: `receipt-cat-${cat}`, row_number: idx + 1, description: cat, amount,
    }));
    const manualRows = additionalRows.filter(r => !r.id.startsWith("receipt-cat-"));
    const merged = [...receiptRows, ...manualRows.map((r, i) => ({ ...r, row_number: receiptRows.length + i + 1 }))];
    setAdditionalRows(merged);
    const checkTotal = merged.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(prev => prev.map(row => {
      if (!row.salary_with_commission) return row;
      const remainder = parseFloat((row.salary_with_commission + checkTotal).toFixed(2));
      return { ...row, remainder_after_tax: remainder, act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)) };
    }));
  }, [additionalRows]);

  // ========== SAVE STATUS INDICATOR ==========
  const renderSaveIndicator = () => {
    if (saveStatus === "saving") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Сохранение...</span>
        </div>
      );
    }
    if (saveStatus === "saved") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <Check className="h-3 w-3" />
          <span>Сохранено</span>
        </div>
      );
    }
    if (saveStatus === "error") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <span>Ошибка сохранения</span>
        </div>
      );
    }
    return null;
  };

  // ========== RENDER ==========
  const renderReportContent = (
    title: string,
    hData: typeof headerData,
    setHData: typeof setHeaderData,
    rRows: typeof rows,
    setRRows: typeof setRows,
    exportBtn: React.ReactNode,
    commissionPercent?: number,
    commissionAmount?: number,
    readOnly?: boolean
  ) => (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {exportBtn}
        {renderSaveIndicator()}
        {readOnly && (
          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Формируется автоматически из УУ + Акт
          </div>
        )}
      </div>
      <Card className="p-6 space-y-6 bg-background">
        <ReportHeader
          data={hData}
          onChange={(field, value) => setHData(prev => ({ ...prev, [field]: value }))}
          title={title}
        />
        <ReportTable
          rows={rRows}
          onChange={setRRows}
          contractNumber={hData.contract_number}
          contractDate={hData.contract_date}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          months={months}
          commissionPercent={commissionPercent}
          commissionAmount={commissionAmount}
          readOnly={readOnly}
        />
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm">
            Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора.
          </p>
        </div>
        <div className="flex justify-between pt-6">
          <div className="space-y-1">
            <p className="text-sm">Отчет сдал: _____________________</p>
            <p className="text-sm">ИП Никулин Егор Викторович</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm">Отчет принял: _____________________</p>
            <p className="text-sm">{hData.recipient_position}</p>
            <p className="text-sm">{hData.recipient_name}</p>
          </div>
        </div>
      </Card>
    </>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen overflow-x-auto">
      <div className="space-y-6 p-4 sm:p-6 min-w-[600px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Отчет агента</h1>
              <p className="text-xs sm:text-base text-muted-foreground">Все отчёты агента на одной странице</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {renderSaveIndicator()}
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[120px] sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="uu">Отчет агента - УУ</TabsTrigger>
            <TabsTrigger value="report">Отчет агента</TabsTrigger>
            <TabsTrigger value="act">Отчет по акту</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="mt-4">
            {/* Selection transparency info */}
            {selectionInfo && (
              <div className="mb-4 space-y-2">
                {selectionInfo.error ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{selectionInfo.error}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Выбрано строк: <strong>{selectionInfo.selectedCount}</strong> из {selectionInfo.totalCount}</span>
                    <span className="text-border">|</span>
                    <span>Сумма до корректировки: <strong>{selectionInfo.totalBeforeAdjust.toFixed(2)} ₽</strong></span>
                    {selectionInfo.adjustedRowIndex !== null && (
                      <>
                        <span className="text-border">|</span>
                        <span>Корректировка: <strong className={selectionInfo.adjustmentDelta > 0 ? "text-primary" : "text-destructive"}>{selectionInfo.adjustmentDelta > 0 ? "+" : ""}{selectionInfo.adjustmentDelta.toFixed(2)} ₽</strong></span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {renderReportContent(
              "Отчет агента", headerData, setHeaderData, rows, setRows,
              <div className="flex items-center gap-2">
                <ExportReportButton
                  headerData={headerData}
                  rows={rows}
                  month={selectedMonth}
                  year={selectedYear}
                  commissionPercent={8}
                />
                <Button
                  variant={reportEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportEditMode(!reportEditMode)}
                >
                  {reportEditMode ? <Lock className="h-3.5 w-3.5 mr-1.5" /> : <Pencil className="h-3.5 w-3.5 mr-1.5" />}
                  {reportEditMode ? "Заблокировать" : "Редактировать"}
                </Button>
              </div>,
              8,
              undefined,
              !reportEditMode
            )}
          </TabsContent>

          <TabsContent value="uu" className="mt-4">
            {renderReportContent(
              "Отчет агента - УУ", uuHeaderData, setUuHeaderData, uuRows, setUuRows,
              <ExportReportButton headerData={uuHeaderData} rows={uuRows} month={selectedMonth} year={selectedYear} />
            )}
          </TabsContent>

          <TabsContent value="act" className="mt-4">
            <div className="space-y-6">
              {agentCommission > 0 && (
                <p className="text-sm text-muted-foreground">
                  Вознаграждение агента за период: {agentCommission.toFixed(2)} ₽
                </p>
              )}

              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Расчет суммы вознаграждения</h2>
                  <div className="flex items-center gap-2">
                    {renderSaveIndicator()}
                    <Button onClick={addCalculationRow} size="sm">
                      <Plus className="h-4 w-4 mr-2" />Добавить строку
                    </Button>
                  </div>
                </div>
                <ActCalculationTable
                  rows={calculationRows}
                  onUpdate={updateCalculationRow}
                  onDelete={deleteCalculationRow}
                  agentCommission={agentCommission}
                  additionalRows={additionalRows}
                />
              </Card>

              <ReceiptManager
                receipts={receipts}
                onReceiptsChange={syncReceiptsToAdditionalRows}
                month={selectedMonth}
                year={selectedYear}
                organizationId={currentOrgId}
              />

              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Дополнительные расходы</h2>
                  <Button onClick={addAdditionalRow} size="sm">
                    <Plus className="h-4 w-4 mr-2" />Добавить строку
                  </Button>
                </div>
                <ActAdditionalTable
                  rows={additionalRows}
                  onUpdate={updateAdditionalRow}
                  onDelete={deleteAdditionalRow}
                />
              </Card>

              <div className="flex justify-end gap-2">
                <ExportActReportButton
                  calculationRows={calculationRows}
                  additionalRows={additionalRows}
                  month={selectedMonth}
                  year={selectedYear}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AgentReport;
