export const AGENT_REPORT_REQUEST_SELECT = "description,contractor,invoice_number,invoice_number_2,invoice_number_3,amount,amount_2,amount_3,status,shipment_date,delivery_date";

export interface AgentReportRequestDates {
  shipment_date: string | null;
  delivery_date: string | null;
}

export function agentReportPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Некорректный отчётный период");
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return {
    start,
    end,
    filter: `and(shipment_date.gte.${start},shipment_date.lt.${end}),and(shipment_date.is.null,delivery_date.gte.${start},delivery_date.lt.${end})`,
  };
}

export function agentReportAnchorDate(request: AgentReportRequestDates) {
  return request.shipment_date || request.delivery_date || null;
}

export function matchesAgentReportPeriod(request: AgentReportRequestDates, year: number, month: number) {
  const { start, end } = agentReportPeriod(year, month);
  const anchor = agentReportAnchorDate(request);
  return anchor !== null && anchor >= start && anchor < end;
}
