import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DadataSuggestion {
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  management_name: string;
  management_post: string;
  type: string;
  opf_short: string;
}

export const useDadataSearch = () => {
  const [suggestions, setSuggestions] = useState<DadataSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("dadata-lookup", {
          body: { query: query.trim(), count: 5 },
        });

        if (error) {
          console.error("DaData search error:", error);
          setSuggestions([]);
          return;
        }

        setSuggestions(data?.suggestions || []);
      } catch (err) {
        console.error("DaData search error:", err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return { suggestions, isSearching, search, clearSuggestions };
};
