import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import HealthAnalysis from '@/components/dashboard/HealthAnalysis';
import SleepAnalysis from '@/components/dashboard/SleepAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Moon, HeartPulse, LinkIcon } from 'lucide-react';

export default function Health() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [hasFitbit, setHasFitbit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (user) {
      checkFitbitConnection();
    }
  }, [user, authLoading, navigate]);

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

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse space-y-4 w-full max-w-md">
            <div className="h-8 bg-muted rounded-lg w-1/3"></div>
            <div className="h-[300px] bg-muted rounded-xl"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{t('nav.health')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasFitbit
              ? 'Analyses op basis van je Fitbit data (90 dagen)'
              : 'Koppel een wearable om je gezondheidsdata te bekijken'}
          </p>
        </div>

        {!hasFitbit ? (
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-muted">
                <HeartPulse className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Geen wearable gekoppeld</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Om je gezondheidsdata zoals slaap, hartslag, stappen en calorieën te bekijken, 
                  moet je eerst een Fitbit-account koppelen via je profiel.
                </p>
              </div>
              <Button asChild className="gap-2">
                <Link to="/profile">
                  <LinkIcon className="h-4 w-4" />
                  Ga naar Profiel om te koppelen
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="health" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="health" className="flex-1 gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Gezondheid
              </TabsTrigger>
              <TabsTrigger value="sleep" className="flex-1 gap-1.5">
                <Moon className="h-3.5 w-3.5" />
                Slaap
              </TabsTrigger>
            </TabsList>
            <TabsContent value="health">
              <HealthAnalysis />
            </TabsContent>
            <TabsContent value="sleep">
              <SleepAnalysis />
            </TabsContent>
          </Tabs>
        )}

        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
