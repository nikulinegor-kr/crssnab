import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export type SubscriptionStatus = "trial" | "active" | "expired" | "canceled" | null;

export interface SubscriptionLimits {
  max_users: number;
  max_requests_per_month: number;
  plan_name: string;
}

export const useSubscription = () => {
  const { currentOrgId } = useCurrentOrganization();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!currentOrgId) {
        setStatus(null);
        setLimits(null);
        setLoading(false);
        return;
      }

      try {
        // Check if has active subscription
        const { data: hasActive, error: hasActiveError } = await supabase.rpc(
          "has_active_subscription",
          { _org_id: currentOrgId }
        );

        if (hasActiveError) {
          console.error("Error checking subscription:", hasActiveError);
          setStatus(null);
        }

        // Get subscription details
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at, current_period_end")
          .eq("organization_id", currentOrgId)
          .single();

        if (subError && subError.code !== "PGRST116") {
          console.error("Error fetching subscription:", subError);
        }

        if (subscription) {
          setStatus(subscription.status as SubscriptionStatus);
          setTrialEndsAt(subscription.trial_ends_at);
        } else {
          setStatus(null);
        }

        // Get subscription limits
        if (hasActive) {
          const { data: limitsData, error: limitsError } = await supabase.rpc(
            "get_org_subscription_limits",
            { _org_id: currentOrgId }
          );

          if (limitsError) {
            console.error("Error fetching limits:", limitsError);
          } else if (limitsData && limitsData.length > 0) {
            setLimits(limitsData[0]);
          }
        }
      } catch (error) {
        console.error("Error in subscription check:", error);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [currentOrgId]);

  const isActive = status === "trial" || status === "active";
  const isTrial = status === "trial";
  const isExpired = status === "expired" || status === "canceled";

  return {
    status,
    limits,
    loading,
    isActive,
    isTrial,
    isExpired,
    trialEndsAt,
  };
};
