import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { normalizeNotificationLink } from "@/lib/notificationLinks";
import { formatNotificationContent } from "@/lib/notificationPresentation";
import { useMyNotifications } from "@/hooks/useMyNotifications";
import { MeSection, MeEmpty } from "./MeSection";

export function MeNotificationsList({ page = 0, pageSize = 10, full = false }: {
  page?: number;
  pageSize?: number;
  full?: boolean;
}) {
  const { list, mark } = useMyNotifications(page, pageSize);
  const navigate = useNavigate();
  const rows = list.data?.rows ?? [];

  return (
    <MeSection title="Уведомления" link={full ? undefined : "/me/notifications"} loading={list.isLoading} error={list.isError} rows={10}>
      <Button variant="link" className="min-h-11 px-0 text-xs" disabled={mark.isPending || !rows.some(row => !row.is_read)} onClick={() => mark.mutate(undefined)}>
        Прочитать все
      </Button>
      {rows.length === 0 ? <MeEmpty>Уведомлений пока нет</MeEmpty> : (
        <div className="divide-y divide-border">
          {rows.map(notification => {
            const { title, message, overdue } = formatNotificationContent(notification);
            return (
              <Button
                key={notification.id}
                variant="ghost"
                className="h-auto min-h-14 w-full items-start justify-start gap-2 rounded-none px-0 py-3 text-left hover:bg-muted hover:text-foreground"
                onClick={() => {
                  mark.mutate(notification.id);
                  navigate(normalizeNotificationLink(notification.link));
                }}
              >
                <span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${notification.is_read ? "bg-transparent" : "bg-primary"}`} />
                <span className="sr-only">{notification.is_read ? "Прочитано" : "Не прочитано"}</span>
                <span className="grid min-w-0 flex-1 gap-1 whitespace-normal break-words">
                  <span className="text-sm font-medium leading-snug">{title}</span>
                  <span className={`text-xs font-normal ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{message}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Получено <time dateTime={notification.created_at} className="tabular-nums">{format(new Date(notification.created_at), "dd.MM HH:mm")}</time>
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
      {full && <p className="mt-2 text-xs text-muted-foreground">{list.data?.count ?? 0} уведомлений</p>}
    </MeSection>
  );
}
