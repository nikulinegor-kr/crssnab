import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, GripVertical, RotateCcw, ArrowLeft } from "lucide-react";
import { menuGroups, findItemById, type MenuItem } from "@/config/sidebarMenu";
import { useSidebarPrefs } from "@/hooks/useSidebarPrefs";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

function SortableRow({
  id,
  item,
  right,
}: {
  id: string;
  item: MenuItem;
  right?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const Icon = item.icon;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md border bg-card",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label="Перетащить"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm flex-1 truncate">{item.title}</span>
      {right}
    </div>
  );
}

export default function SidebarSettings() {
  const { hasRouteAccess } = useUserPermissions();
  const {
    prefs,
    toggleHidden,
    toggleFavorite,
    setGroupOrder,
    setFavoritesOrder,
    reset,
  } = useSidebarPrefs();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Allowed groups/items filtered by role
  const allowedGroups = useMemo(
    () =>
      menuGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => hasRouteAccess(i.url)) }))
        .filter((g) => g.items.length > 0),
    [hasRouteAccess],
  );

  const favoriteItems = prefs.favorites
    .map(findItemById)
    .filter((i): i is MenuItem => !!i && hasRouteAccess(i.url));

  const totalItems = allowedGroups.reduce((n, g) => n + g.items.length, 0);
  const visibleCount = totalItems - prefs.hidden.filter((id) => findItemById(id)).length;

  const orderedGroupItems = (groupKey: string, items: MenuItem[]) => {
    const savedOrder = prefs.order[groupKey];
    if (!savedOrder) return items;
    const map = new Map(items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const ordered: MenuItem[] = [];
    for (const id of savedOrder) {
      const it = map.get(id);
      if (it) {
        ordered.push(it);
        seen.add(id);
      }
    }
    for (const it of items) if (!seen.has(it.id)) ordered.push(it);
    return ordered;
  };

  const onGroupDragEnd = (groupKey: string, items: MenuItem[]) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setGroupOrder(groupKey, arrayMove(ids, oldIdx, newIdx));
  };

  const onFavoritesDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = favoriteItems.map((i) => i.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setFavoritesOrder(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/organization/settings"><ArrowLeft className="h-4 w-4 mr-1" />Настройки</Link>
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-2" />Сбросить
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройка бокового меню</h1>
        <p className="text-sm text-muted-foreground">
          Показано {visibleCount} из {totalItems} доступных пунктов. Настройки сохраняются
          для вашего профиля и восстанавливаются при следующем входе.
        </p>
      </div>

      {/* Favorites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" />
            Избранное
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {favoriteItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока пусто. Нажмите звёздочку рядом с любым пунктом ниже, чтобы закрепить его в верхней части меню.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFavoritesDragEnd}>
              <SortableContext items={favoriteItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {favoriteItems.map((item) => (
                    <SortableRow
                      key={item.id}
                      id={item.id}
                      item={item}
                      right={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => toggleFavorite(item.id)}
                          aria-label="Убрать из избранного"
                        >
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        </Button>
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Groups */}
      {allowedGroups.map((group) => {
        const items = orderedGroupItems(group.key, group.items);
        return (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <group.icon className="h-4 w-4 text-muted-foreground" />
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd(group.key, items)}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => {
                      const isHidden = prefs.hidden.includes(item.id);
                      const isFav = prefs.favorites.includes(item.id);
                      return (
                        <SortableRow
                          key={item.id}
                          id={item.id}
                          item={item}
                          right={
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => toggleFavorite(item.id)}
                                aria-label={isFav ? "Убрать из избранного" : "В избранное"}
                              >
                                <Star className={cn("h-4 w-4", isFav ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                              </Button>
                              <Separator orientation="vertical" className="h-5" />
                              <Switch
                                checked={!isHidden}
                                onCheckedChange={() => toggleHidden(item.id)}
                                aria-label={isHidden ? "Показать" : "Скрыть"}
                              />
                            </div>
                          }
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
