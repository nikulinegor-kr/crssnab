import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const PushNotificationSettings = () => {
  const { permission, isSupported, isEnabled, requestPermission, sendNotification } = usePushNotifications();

  const handleTestNotification = async () => {
    await sendNotification("Тестовое уведомление", {
      body: "Push-уведомления работают корректно!",
      link: "/organization/settings"
    });
  };

  const getStatusIcon = () => {
    switch (permission) {
      case 'granted':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'unsupported':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (permission) {
      case 'granted':
        return 'Уведомления включены';
      case 'denied':
        return 'Уведомления заблокированы в браузере';
      case 'unsupported':
        return 'Браузер не поддерживает push-уведомления';
      default:
        return 'Уведомления не настроены';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push-уведомления
        </CardTitle>
        <CardDescription>
          Получайте браузерные уведомления о важных событиях
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">{getStatusText()}</p>
              <p className="text-sm text-muted-foreground">
                {isEnabled 
                  ? 'Вы будете получать уведомления о новых событиях'
                  : 'Включите уведомления, чтобы не пропустить важные события'}
              </p>
            </div>
          </div>
          {permission === 'default' && (
            <Button onClick={requestPermission}>
              Включить
            </Button>
          )}
        </div>

        {/* Enable/Disable toggle */}
        {isSupported && permission !== 'unsupported' && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-enabled" className="text-base">
                Браузерные уведомления
              </Label>
              <p className="text-sm text-muted-foreground">
                Показывать уведомления даже когда вкладка неактивна
              </p>
            </div>
            <Switch
              id="push-enabled"
              checked={isEnabled}
              disabled={permission === 'denied'}
              onCheckedChange={(checked) => {
                if (checked && permission === 'default') {
                  requestPermission();
                }
              }}
            />
          </div>
        )}

        {/* Test notification */}
        {isEnabled && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-0.5">
              <Label className="text-base">Тестовое уведомление</Label>
              <p className="text-sm text-muted-foreground">
                Проверьте работу push-уведомлений
              </p>
            </div>
            <Button variant="outline" onClick={handleTestNotification}>
              Отправить тест
            </Button>
          </div>
        )}

        {/* Denied state help */}
        {permission === 'denied' && (
          <Alert>
            <BellOff className="h-4 w-4" />
            <AlertDescription>
              Уведомления заблокированы в настройках браузера. Чтобы включить их:
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Нажмите на иконку замка слева от адресной строки</li>
                <li>Найдите раздел "Уведомления"</li>
                <li>Выберите "Разрешить"</li>
                <li>Обновите страницу</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {/* Info about notification types */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Push-уведомления включают:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Напоминания о дедлайнах заявок</li>
              <li>Новые комментарии к вашим заявкам</li>
              <li>Изменения статусов заявок</li>
              <li>Назначение исполнителем</li>
              <li>События календаря</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
