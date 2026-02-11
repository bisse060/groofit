import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Moon, Activity } from 'lucide-react';
import SleepAnalysis from './SleepAnalysis';
import HealthAnalysis from './HealthAnalysis';

export default function FitbitAnalysisTabs() {
  const { user } = useAuth();
  const [hasFitbit, setHasFitbit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) checkFitbitConnection();
  }, [user]);

  const checkFitbitConnection = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_fitbit_connection_status', { p_user_id: user?.id })
        .maybeSingle();

      if (!error && data) {
        setHasFitbit(true);
      }
    } catch (error) {
      console.error('Error checking Fitbit connection:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !hasFitbit) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Fitbit Analyse (90 dagen)
      </h2>
      <Tabs defaultValue="sleep" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="sleep" className="flex-1 gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            Slaap
          </TabsTrigger>
          <TabsTrigger value="health" className="flex-1 gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Gezondheid
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sleep">
          <SleepAnalysis />
        </TabsContent>
        <TabsContent value="health">
          <HealthAnalysis />
        </TabsContent>
      </Tabs>
    </section>
  );
}
