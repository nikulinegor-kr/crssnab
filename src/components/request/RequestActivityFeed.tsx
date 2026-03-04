import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, History, User, Settings } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  user_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface RequestActivityFeedProps {
  activities: Activity[] | undefined;
}

export function RequestActivityFeed({ activities }: RequestActivityFeedProps) {
  // Separate user actions from system events
  const userActions = activities?.filter(a => 
    a.action === 'created' || 
    a.action === 'comment' ||
    (a.user_id && !isSystemField(a.field_name))
  ) || [];
  
  const systemEvents = activities?.filter(a => 
    !a.user_id || isSystemField(a.field_name)
  ) || [];

  function isSystemField(fieldName: string | null): boolean {
    const systemFields = ['updated_at', 'created_at', 'organization_id'];
    return systemFields.includes(fieldName || '');
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <div className="h-2.5 w-2.5 rounded-full bg-green-500 ring-4 ring-green-500/10" />;
      case 'updated':
        return <div className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/10" />;
      case 'comment':
        return <div className="h-2.5 w-2.5 rounded-full bg-purple-500 ring-4 ring-purple-500/10" />;
      default:
        return <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-muted/30" />;
    }
  };

  const renderActivityItem = (activity: Activity, index: number, isSystem: boolean = false) => (
    <div 
      key={activity.id} 
      className={cn(
        "flex gap-4 transition-colors",
        isSystem && "opacity-60"
      )}
    >
      <div className="relative">
        <div className="mt-2">
          {isSystem ? (
            <Settings className="h-3 w-3 text-muted-foreground" />
          ) : (
            getActionIcon(activity.action)
          )}
        </div>
        {index < (isSystem ? systemEvents.length - 1 : userActions.length - 1) && (
          <div className="absolute left-1.5 top-4 bottom-0 w-[1px] bg-border" />
        )}
      </div>
      <div className="flex-1 pb-6">
        <p className={cn(
          "text-sm",
          isSystem ? "text-muted-foreground" : "font-medium"
        )}>
          {activity.description}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {!isSystem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {activity.profiles?.full_name || activity.profiles?.email || "Пользователь"}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(activity.created_at), "dd.MM.yyyy, HH:mm", { locale: ru })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          История изменений
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all" className="text-xs gap-1.5">
              <History className="h-3 w-3" />
              Все
            </TabsTrigger>
            <TabsTrigger value="user" className="text-xs gap-1.5">
              <User className="h-3 w-3" />
              Действия
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs gap-1.5">
              <Settings className="h-3 w-3" />
              Система
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-0">
              {activities && activities.length > 0 ? (
                activities.map((activity, index) => 
                  renderActivityItem(activity, index, !activity.user_id || isSystemField(activity.field_name))
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  История действий пока пуста
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="user" className="mt-0">
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-0">
              {userActions.length > 0 ? (
                userActions.map((activity, index) => 
                  renderActivityItem(activity, index, false)
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Нет действий пользователей
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-0">
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-0">
              {systemEvents.length > 0 ? (
                systemEvents.map((activity, index) => 
                  renderActivityItem(activity, index, true)
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Нет системных событий
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
