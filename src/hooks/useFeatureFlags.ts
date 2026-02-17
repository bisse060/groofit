import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useFeatureFlags() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFlags([]);
      setLoading(false);
      return;
    }

    const fetchFlags = async () => {
      const { data } = await supabase
        .from('user_feature_flags')
        .select('feature_key')
        .eq('user_id', user.id)
        .eq('enabled', true);

      setFlags(data?.map(f => f.feature_key) || []);
      setLoading(false);
    };

    fetchFlags();
  }, [user]);

  return { flags, hasFlag: (key: string) => flags.includes(key), loading };
}
