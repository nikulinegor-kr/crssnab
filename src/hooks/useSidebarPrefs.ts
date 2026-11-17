import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { menuGroups, SIDEBAR_STRUCTURE_VERSION } from "@/config/sidebarMenu";

export type SidebarPrefs = {
  hidden: string[];
  order: Record<string, string[]>;
  favorites: string[];
  structureVersion: number;
};

const DEFAULT: SidebarPrefs = {
  hidden: [],
  order: {},
  favorites: [],
  structureVersion: SIDEBAR_STRUCTURE_VERSION,
};

function keyFor(userId: string | null) {
  return `sidebar:prefs:v1:${userId ?? "anon"}`;
}

export function sanitizeSidebarPrefs(value: unknown): SidebarPrefs {
  const parsed = value && typeof value === "object" ? value as Partial<SidebarPrefs> : {};
  const validIds = new Set(menuGroups.flatMap((group) => group.items.map((item) => item.id)));
  const validGroups = new Set(menuGroups.map((group) => group.key));
  const uniqueValid = (input: unknown) => Array.isArray(input)
    ? [...new Set(input.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
    : [];

  const order: Record<string, string[]> = {};
  // После смены структуры старый порядок применяется один раз: новый порядок групп становится базовым.
  if (parsed.structureVersion === SIDEBAR_STRUCTURE_VERSION && parsed.order && typeof parsed.order === "object") {
    for (const [groupKey, ids] of Object.entries(parsed.order)) {
      if (validGroups.has(groupKey)) order[groupKey] = uniqueValid(ids);
    }
  }

  return {
    hidden: uniqueValid(parsed.hidden),
    favorites: uniqueValid(parsed.favorites),
    order,
    structureVersion: SIDEBAR_STRUCTURE_VERSION,
  };
}

function read(userId: string | null): SidebarPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? sanitizeSidebarPrefs(JSON.parse(raw)) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useSidebarPrefs() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<SidebarPrefs>(DEFAULT);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setPrefs(read(uid));
    });
  }, []);

  const save = useCallback(
    (next: SidebarPrefs) => {
      const sanitized = sanitizeSidebarPrefs(next);
      setPrefs(sanitized);
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(sanitized));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent("sidebar-prefs-changed"));
    },
    [userId],
  );

  useEffect(() => {
    const onChange = () => setPrefs(read(userId));
    window.addEventListener("sidebar-prefs-changed", onChange);
    return () => window.removeEventListener("sidebar-prefs-changed", onChange);
  }, [userId]);

  const toggleHidden = (id: string) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((itemId) => itemId !== id)
      : [...prefs.hidden, id];
    save({ ...prefs, hidden });
  };

  const toggleFavorite = (id: string) => {
    const favorites = prefs.favorites.includes(id)
      ? prefs.favorites.filter((itemId) => itemId !== id)
      : [...prefs.favorites, id];
    save({ ...prefs, favorites });
  };

  const setGroupOrder = (groupKey: string, ids: string[]) =>
    save({ ...prefs, order: { ...prefs.order, [groupKey]: ids } });

  const setFavoritesOrder = (ids: string[]) => save({ ...prefs, favorites: ids });

  const reset = () => save(DEFAULT);

  return { prefs, toggleHidden, toggleFavorite, setGroupOrder, setFavoritesOrder, reset };
}
