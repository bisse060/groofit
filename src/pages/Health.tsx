import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import HealthAnalysis from '@/components/dashboard/HealthAnalysis';
import SleepAnalysis from '@/components/dashboard/SleepAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Moon } from 'lucide-react';

export default function Health() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('nav.health')}</h1>
          <p className="text-sm text-muted-foreground mt-1">Analyses op basis van je Fitbit data (90 dagen)</p>
        </div>

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

        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
