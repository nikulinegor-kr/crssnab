import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Info, Package, Receipt, Inbox, AlertTriangle } from "lucide-react";

const ROUTES = [
  {
    type: "supply",
    label: "Поставка ТМЦ",
    icon: Package,
    triggers: [
      "Заявка переведена в статус «В пути» / «Доставлено в ТК» / «Доставлено»",
      "Подтверждение прибытия груза (cron check-delivery-arrived)",
      "Массовое обновление статуса доставки",
      "Изменение даты доставки или транспортной компании",
    ],
  },
  {
    type: "invoice",
    label: "Счета на оплату",
    icon: Receipt,
    triggers: [
      "Загружен счёт (распознавание OCR подтверждено)",
      "Изменён статус оплаты заявки (предоплата / оплачено)",
      "Поступила сумма больше пороговой — оповещение бухгалтеру",
    ],
  },
  {
    type: "request",
    label: "Входящие заявки",
    icon: Inbox,
    triggers: [
      "Создана новая заявка (auto-send-on-create)",
      "Заявка отправлена на доработку — комментарий причины",
      "Назначен / изменён исполнитель",
      "Добавлен комментарий в карточку заявки",
    ],
  },
  {
    type: "alert",
    label: "CRSS оповещения",
    icon: AlertTriangle,
    triggers: [
      "Просрочка дедлайна заявки (cron check-deadline-reminders)",
      "Низкие остатки на складе (LowStockWidget)",
      "Системные ошибки и сбои интеграций",
      "Ежедневная сводка (daily-summary)",
    ],
  },
];

export const NotificationRoutingInfo = () => {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Куда уходят сообщения и при каких условиях</CardTitle>
            <CardDescription>
              Тип уведомления у группы определяет, какие события в CRM в неё пересылаются.
              Одинаково работает для Telegram и MAX — достаточно привязать группу с нужным типом.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Тип группы</TableHead>
              <TableHead>События / условия отправки</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROUTES.map((r) => {
              const Icon = r.icon;
              return (
                <TableRow key={r.type}>
                  <TableCell className="align-top">
                    <Badge variant="secondary" className="gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {r.label}
                    </Badge>
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                      {r.type}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {r.triggers.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-4">
          Если для типа не привязана активная группа — сообщение просто не отправляется (ошибки нет).
          Можно привязать несколько групп одного типа — сообщение уйдёт во все одновременно.
        </p>
      </CardContent>
    </Card>
  );
};
