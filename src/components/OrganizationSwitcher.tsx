import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check } from "lucide-react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";

interface Organization {
  id: string;
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
  };
}

export const OrganizationSwitcher = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrgId, setCurrentOrgId } = useCurrentOrganization();

  const { data: organizations = [] } = useQuery({
    queryKey: ["user-organizations-list"],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select(`
          id,
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `);
      if (error) throw error;
      return (data ?? []) as unknown as Organization[];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const currentOrg =
    organizations.find((o) => o.organization_id === currentOrgId) ?? null;


  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    window.location.reload(); // Reload to refresh data for new organization
  };

  if (!currentOrg) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" />
          {currentOrg.organizations.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ваши организации</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.organization_id)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span>{org.organizations.name}</span>
              {org.organization_id === currentOrgId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
