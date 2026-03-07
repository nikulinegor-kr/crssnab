import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRequestFavorites = () => {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchFavorites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("request_favorites" as any)
      .select("request_id")
      .eq("user_id", user.id);

    if (!error && data) {
      setFavoriteIds(new Set((data as any[]).map((f: any) => f.request_id)));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = useCallback(async (requestId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isFav = favoriteIds.has(requestId);

    if (isFav) {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });

      const { error } = await (supabase.from("request_favorites" as any) as any)
        .delete()
        .eq("user_id", user.id)
        .eq("request_id", requestId);

      if (error) {
        setFavoriteIds(prev => new Set(prev).add(requestId));
        toast({ title: "Ошибка", description: "Не удалось убрать из избранного", variant: "destructive" });
      }
    } else {
      setFavoriteIds(prev => new Set(prev).add(requestId));

      const { error } = await (supabase.from("request_favorites" as any) as any)
        .insert({ user_id: user.id, request_id: requestId });

      if (error) {
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
        toast({ title: "Ошибка", description: "Не удалось добавить в избранное", variant: "destructive" });
      }
    }
  }, [favoriteIds, toast]);

  return { favoriteIds, toggleFavorite, isLoading };
};
