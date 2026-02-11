import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  features: string[];
  price_monthly: number;
  price_yearly: number;
}

interface SubscriptionState {
  tier: SubscriptionTier | null;
  tierName: string;
  features: string[];
  loading: boolean;
  hasFeature: (feature: string) => boolean;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTier(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('tier_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (sub?.tier_id) {
          const { data: tierData } = await supabase
            .from('subscription_tiers')
            .select('*')
            .eq('id', sub.tier_id)
            .single();

          setTier(tierData as SubscriptionTier | null);
        }
      } catch (err) {
        console.error('Error loading subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const hasFeature = (feature: string): boolean => {
    if (!tier) return false;
    return tier.features.includes(feature);
  };

  return {
    tier,
    tierName: tier?.display_name || 'Free',
    features: tier?.features || [],
    loading,
    hasFeature,
  };
}
