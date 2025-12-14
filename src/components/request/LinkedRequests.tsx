import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link2, Plus, X, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

interface LinkedRequestsProps {
  requestId: string;
  canEdit: boolean;
}

export function LinkedRequests({ requestId, canEdit }: LinkedRequestsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();

  // Fetch linked requests
  const { data: linkedRequests, isLoading } = useQuery({
    queryKey: ["linked-requests", requestId],
    queryFn: async () => {
      // Get links where this request is either the source or target
      const { data: links, error } = await supabase
        .from("linked_requests")
        .select("*")
        .or(`request_id.eq.${requestId},linked_request_id.eq.${requestId}`);

      if (error) throw error;

      // Get all related request IDs
      const relatedIds = links?.flatMap(link => 
        [link.request_id, link.linked_request_id].filter(id => id !== requestId)
      ) || [];

      if (relatedIds.length === 0) return [];

      // Fetch request details
      const { data: requests, error: reqError } = await supabase
        .from("requests")
        .select("id, request_number, description, status, priority")
        .in("id", relatedIds);

      if (reqError) throw reqError;

      return requests || [];
    },
    enabled: !!requestId,
  });

  // Search for requests to link
  const { data: searchResults } = useQuery({
    queryKey: ["search-requests", searchQuery, currentOrgId],
    queryFn: async () => {
      if (!searchQuery.trim() || !currentOrgId) return [];

      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status")
        .eq("organization_id", currentOrgId)
        .neq("id", requestId)
        .or(`description.ilike.%${searchQuery}%,request_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      // Filter out already linked
      const linkedIds = linkedRequests?.map(r => r.id) || [];
      return data?.filter(r => !linkedIds.includes(r.id)) || [];
    },
    enabled: searchQuery.length >= 2 && !!currentOrgId,
  });

  const linkMutation = useMutation({
    mutationFn: async (linkedRequestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("linked_requests")
        .insert({
          request_id: requestId,
          linked_request_id: linkedRequestId,
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-requests", requestId] });
      setSearchQuery("");
      setDialogOpen(false);
      toast({ title: "Заявка связана" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось связать заявки",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkedRequestId: string) => {
      const { error } = await supabase
        .from("linked_requests")
        .delete()
        .or(`and(request_id.eq.${requestId},linked_request_id.eq.${linkedRequestId}),and(request_id.eq.${linkedRequestId},linked_request_id.eq.${requestId})`);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-requests", requestId] });
      toast({ title: "Связь удалена" });
    },
  });

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Связанные заявки ({linkedRequests?.length || 0})
          </CardTitle>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Связать
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Связать с другой заявкой</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по номеру или описанию..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {searchResults?.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {request.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.request_number}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => linkMutation.mutate(request.id)}
                          disabled={linkMutation.isPending}
                        >
                          {linkMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Связать"
                          )}
                        </Button>
                      </div>
                    ))}
                    {searchQuery.length >= 2 && searchResults?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Заявки не найдены
                      </p>
                    )}
                    {searchQuery.length < 2 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Введите минимум 2 символа для поиска
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : linkedRequests?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет связанных заявок
          </p>
        ) : (
          <div className="space-y-2">
            {linkedRequests?.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/requests/${request.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {request.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {request.request_number}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {request.status}
                    </Badge>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      unlinkMutation.mutate(request.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
