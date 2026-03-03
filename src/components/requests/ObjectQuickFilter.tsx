import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";

const OBJECT_FILTER_KEY = "requests_object_filter";

interface ObjectQuickFilterProps {
  requests: Request[] | undefined;
  organizationId: string | null | undefined;
  objectFilter: string;
  setObjectFilter: (value: string) => void;
}

export const ObjectQuickFilter = ({
  requests,
  organizationId,
  objectFilter,
  setObjectFilter,
}: ObjectQuickFilterProps) => {
  // Fetch request_objects for the organization
  const { data: requestObjects } = useQuery({
    queryKey: ["request_objects", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Get unique object_ids that actually have requests
  const objectIdsWithRequests = useMemo(() => {
    if (!requests) return new Set<string>();
    return new Set(requests.map(r => r.object_id).filter(Boolean) as string[]);
  }, [requests]);

  // Filter objects to only those that have requests
  const availableObjects = useMemo(() => {
    if (!requestObjects) return [];
    return requestObjects.filter(obj => objectIdsWithRequests.has(obj.id));
  }, [requestObjects, objectIdsWithRequests]);

  // Auto-reset if selected object no longer has requests
  useEffect(() => {
    if (objectFilter !== "all" && !objectIdsWithRequests.has(objectFilter)) {
      setObjectFilter("all");
    }
  }, [objectFilter, objectIdsWithRequests, setObjectFilter]);

  // Don't render if no objects available
  if (availableObjects.length === 0) return null;

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 sm:gap-2 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setObjectFilter("all")}
          className={cn(
            "h-7 sm:h-8 text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 transition-all shrink-0 whitespace-nowrap",
            objectFilter === "all"
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "text-muted-foreground border-border hover:bg-muted"
          )}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>Все объекты</span>
        </Button>
        {availableObjects.map((obj) => (
          <Button
            key={obj.id}
            variant="outline"
            size="sm"
            onClick={() => setObjectFilter(objectFilter === obj.id ? "all" : obj.id)}
            className={cn(
              "h-7 sm:h-8 text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 transition-all shrink-0 whitespace-nowrap",
              objectFilter === obj.id
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "text-muted-foreground border-border hover:bg-muted"
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>{obj.name}</span>
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="h-1.5" />
    </ScrollArea>
  );
};
