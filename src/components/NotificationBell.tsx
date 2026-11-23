import { useRef, useState } from "react";
import { Bell, ChevronDown, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { normalizeNotificationLink } from "@/lib/notificationLinks";
import { formatNotificationContent } from "@/lib/notificationPresentation";
import { pluralRu } from "@/lib/pluralRu";
import { cn } from "@/lib/utils";

type NotificationEntry = ReturnType<typeof formatNotificationContent> & { notification: Notification };

const notificationRowClass = "flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

function NotificationRow({ entry, onSelect }: {
  entry: NotificationEntry;
  onSelect: (notification: Notification) => void;
}) {
  const { notification, title, message, overdue } = entry;
  return (
    <li>
      <button type="button" className={notificationRowClass} onClick={() => onSelect(notification)}>
        <span aria-hidden="true" className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !notification.is_read && "bg-primary")} />
        <span className="grid min-w-0 flex-1 gap-1 break-words">
          <span className="text-sm font-semibold leading-snug">{title}</span>
          {message && <span className={cn("text-sm leading-snug", overdue ? "text-destructive" : "text-muted-foreground")}>{message}</span>}
          <span className="text-xs leading-snug text-muted-foreground">
            Получено <time dateTime={notification.created_at} className="tabular-nums">{format(new Date(notification.created_at), "d MMM, HH:mm", { locale: ru })}</time>
          </span>
        </span>
      </button>
    </li>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const entries = (notifications ?? []).map(notification => ({ notification, ...formatNotificationContent(notification) }));
  const overdue = entries.filter(entry => entry.overdue);
  const groupOverdue = overdue.length > 1;
  const canMarkAll = entries.some(({ notification }) => notification.type !== "task_assigned");

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type !== "task_assigned") markAsRead(notification.id);
    setOpen(false);
    if (notification.link) navigate(normalizeNotificationLink(notification.link));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unreadCount ? "Уведомления, есть непрочитанные" : "Уведомления"} className="relative size-11">
          <Bell className="!size-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span aria-hidden="true" className="absolute -right-0.5 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold tabular-nums text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Уведомления"
        onOpenAutoFocus={event => {
          event.preventDefault();
          heading.current?.focus({ preventScroll: true });
        }}
        className="flex max-h-[min(31rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl p-0"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 border-b px-4 py-1">
          <h2 ref={heading} tabIndex={-1} className="py-2 text-base font-semibold outline-none">Уведомления</h2>
          {canMarkAll && (
            <Button type="button" variant="link" size="sm" className="h-11 px-0" onClick={() => markAllAsRead()}>
              Прочитать все
            </Button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <p role="status" className="px-4 py-5 text-sm text-muted-foreground">Загружаем уведомления…</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">Новых уведомлений нет</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map(entry => {
                if (!groupOverdue || !entry.overdue) {
                  return <NotificationRow key={entry.notification.id} entry={entry} onSelect={handleNotificationClick} />;
                }
                if (entry !== overdue[0]) return null;
                return (
                  <li key="overdue">
                    <details className="group">
                      <summary className={cn(notificationRowClass, "cursor-pointer items-center [&::-webkit-details-marker]:hidden")}>
                        <Clock className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                        <span className="grid min-w-0 flex-1 gap-1">
                          <span className="text-sm font-semibold leading-snug">Просроченные задачи</span>
                          <span className="text-xs text-muted-foreground">
                            {overdue.length} {pluralRu(overdue.length, ["напоминание", "напоминания", "напоминаний"])}
                          </span>
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                      </summary>
                      <ul className="divide-y divide-border border-t">
                        {overdue.map(reminder => (
                          <NotificationRow key={reminder.notification.id} entry={reminder} onSelect={handleNotificationClick} />
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t px-4">
          <Button asChild variant="link" className="h-11 px-0">
            <Link to="/me/notifications" onClick={() => setOpen(false)}>Все уведомления</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
