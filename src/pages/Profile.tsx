import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    current_weight: '',
    target_weight: '',
    height_cm: '',
    goals: '',
    instagram_username: '',
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          username: data.username || '',
          full_name: data.full_name || '',
          current_weight: data.current_weight?.toString() || '',
          target_weight: data.target_weight?.toString() || '',
          height_cm: data.height_cm?.toString() || '',
          goals: data.goals || '',
          instagram_username: data.instagram_username || '',
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: profile.username,
          full_name: profile.full_name,
          current_weight: profile.current_weight ? parseFloat(profile.current_weight) : null,
          target_weight: profile.target_weight ? parseFloat(profile.target_weight) : null,
          height_cm: profile.height_cm ? parseInt(profile.height_cm) : null,
          goals: profile.goals,
          instagram_username: profile.instagram_username,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
          <p className="text-muted-foreground">Manage your profile information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">{t('auth.username')}</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">{t('auth.fullName')}</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="current_weight">{t('profile.currentWeight')}</Label>
                  <Input
                    id="current_weight"
                    type="number"
                    step="0.1"
                    value={profile.current_weight}
                    onChange={(e) => setProfile({ ...profile, current_weight: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_weight">{t('profile.targetWeight')}</Label>
                  <Input
                    id="target_weight"
                    type="number"
                    step="0.1"
                    value={profile.target_weight}
                    onChange={(e) => setProfile({ ...profile, target_weight: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height_cm">{t('profile.height')}</Label>
                  <Input
                    id="height_cm"
                    type="number"
                    value={profile.height_cm}
                    onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">{t('profile.goals')}</Label>
                <Textarea
                  id="goals"
                  value={profile.goals}
                  onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
                  rows={4}
                  placeholder="Describe your fitness goals..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">{t('profile.instagram')}</Label>
                <Input
                  id="instagram"
                  value={profile.instagram_username}
                  onChange={(e) => setProfile({ ...profile, instagram_username: e.target.value })}
                  placeholder="@username"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? t('common.loading') : t('profile.save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
