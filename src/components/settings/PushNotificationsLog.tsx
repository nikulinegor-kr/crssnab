import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { History, Volume2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const PUSH_LOG_KEY = "crss-push-log-v1";
const PUSH_SOUND_KEY = "crss-push-sound";

interface LogEntry {
  title: string;
  body: string;
  link?: string | null;
  ts: string;
}

export const PushNotificationsLog = () => {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sound, setSound] = useState(localStorage.getItem(PUSH_SOUND_KEY) !== "off");

  const load = () => {
    try {
      const raw = localStorage.getItem(PUSH_LOG_KEY);
      setLog(raw ? JSON.parse(raw) : []);
    } catch {
      setLog([]);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const toggleSound = (v: boolean) => {
    setSound(v);
    localStorage.setItem(PUSH_SOUND_KEY, v ? "on" : "off");
  };

  const clearLog = () => {
    localStorage.removeItem(PUSH_LOG_KEY);
    setLog([]);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="push-sound" className="font-normal text-sm">
            Звук уведомления
          </Label>
        </div>
        <Switch id="push-sound" checked={sound} onCheckedChange={toggleSound} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            Последние уведомления
            <span className="text-xs font-normal text-muted-foreground">({log.length})</span>
          </div>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearLog} className="h-7 px-2 gap-1 text-xs">
              <Trash2 className="h-3 w-3" />
              Очистить
            </Button>
          )}
        </div>

        {log.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3 text-center border rounded-md bg-muted/30">
            Пока нет уведомлений
          </div>
        ) : (
          <div className="space-y-1 max-h-[260px] overflow-y-auto rounded-md border bg-muted/20 p-2">
            {log.map((e, i) => (
              <div key={i} className="text-xs px-2 py-1.5 rounded hover:bg-muted/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-foreground truncate">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground shrink-0 font-numeric">
                    {format(new Date(e.ts), "dd.MM HH:mm", { locale: ru })}
                  </div>
                </div>
                <div className="text-muted-foreground truncate">{e.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[12px] text-muted-foreground leading-relaxed border-l-2 border-muted pl-3">
        <strong className="text-foreground">macOS:</strong> уведомления автоматически попадают в Notification Center, если в системных настройках для вашего браузера разрешены уведомления (Системные настройки → Уведомления → Chrome/Safari/Edge).
      </div>
    </div>
  );
};
