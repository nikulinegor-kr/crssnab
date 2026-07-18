import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SidebarPrefs = {
  hidden: string[]; // item ids
  order: Record<string, string[]>; // groupKey -> ordered item ids
  favorites: string[]; // item ids (also ordered)
};

const DEFAULT: SidebarPrefs = { hidden: [], order: {}, favorites: [] };

function keyFor(userId: string | null) {
  return `sidebar:prefs:v1:${userId ?? "anon"}`;
}

function read(userId: string | null): SidebarPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      order: parsed.order && typeof parsed.order === "object" ? parsed.order : {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
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
      setPrefs(next);
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(next));
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
      ? prefs.hidden.filter((x) => x !== id)
      : [...prefs.hidden, id];
    save({ ...prefs, hidden });
  };

  const toggleFavorite = (id: string) => {
    const favorites = prefs.favorites.includes(id)
      ? prefs.favorites.filter((x) => x !== id)
      : [...prefs.favorites, id];
    save({ ...prefs, favorites });
  };

  const setGroupOrder = (groupKey: string, ids: string[]) =>
    save({ ...prefs, order: { ...prefs.order, [groupKey]: ids } });

  const setFavoritesOrder = (ids: string[]) => save({ ...prefs, favorites: ids });

  const reset = () => save(DEFAULT);

  return { prefs, toggleHidden, toggleFavorite, setGroupOrder, setFavoritesOrder, reset };
}
