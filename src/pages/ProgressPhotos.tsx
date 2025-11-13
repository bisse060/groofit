import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Camera, Upload } from 'lucide-react';

export default function ProgressPhotos() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPhotos();
    }
  }, [user]);

  const loadPhotos = async () => {
    try {
      setLoading(false);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p>{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.photos')}</h1>
          <p className="text-muted-foreground">Document your fitness journey with progress photos</p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Upload Progress Photos</h3>
            <p className="text-muted-foreground mb-6">
              Start documenting your transformation journey
            </p>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Photos will be displayed here */}
        </div>
      </div>
    </Layout>
  );
}
