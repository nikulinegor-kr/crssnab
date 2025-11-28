import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportHeaderProps {
  data: {
    report_number: string;
    contract_number: string;
    contract_date: string;
    period_start: string;
    period_end: string;
    company_name: string;
    company_address: string;
    company_phone: string;
    recipient_name: string;
    recipient_position: string;
  };
  onChange: (field: string, value: string) => void;
  title?: string;
}

export const ReportHeader = ({ data, onChange, title = "Отчет агента - УУ" }: ReportHeaderProps) => {
  return (
    <div className="space-y-6 bg-background p-6 rounded-lg border">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">ПРИЛОЖЕНИЕ №1</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span>К агентскому договору №</span>
            <Input
              value={data.contract_number}
              onChange={(e) => onChange("contract_number", e.target.value)}
              className="w-32 h-8 text-center"
            />
            <span>от</span>
            <Input
              type="date"
              value={data.contract_date}
              onChange={(e) => onChange("contract_date", e.target.value)}
              className="w-40 h-8"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="space-y-2 w-1/2">
          <Label>Кому:</Label>
          <Input
            value={data.company_name}
            onChange={(e) => onChange("company_name", e.target.value)}
            placeholder="Название компании"
          />
          <Input
            value={data.company_address}
            onChange={(e) => onChange("company_address", e.target.value)}
            placeholder="Адрес"
          />
          <Input
            value={data.company_phone}
            onChange={(e) => onChange("company_phone", e.target.value)}
            placeholder="Телефон/факс"
          />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-bold">{title}</h3>
        <div className="flex items-center justify-center gap-2">
          <span>по агентскому договору №</span>
          <span className="font-semibold">{data.contract_number}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span>За период с</span>
          <Input
            type="date"
            value={data.period_start}
            onChange={(e) => onChange("period_start", e.target.value)}
            className="w-40 h-8"
          />
          <span>г. по</span>
          <Input
            type="date"
            value={data.period_end}
            onChange={(e) => onChange("period_end", e.target.value)}
            className="w-40 h-8"
          />
          <span>г. произведен закуп ТМЦ:</span>
        </div>
      </div>
    </div>
  );
};
