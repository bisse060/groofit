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
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Activity, Unlink } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    current_weight: '',
    target_weight: '',
    height_cm: '',
    goals: '',
    instagram_username: '',
    fitbit_user_id: null as string | null,
    fitbit_connected_at: null as string | null,
    fitbit_last_sync_at: null as string | null,
  });
  const [connectingFitbit, setConnectingFitbit] = useState(false);
  const [syncingHistorical, setSyncingHistorical] = useState(false);

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
          full_name: data.full_name || '',
          current_weight: data.current_weight?.toString() || '',
          target_weight: data.target_weight?.toString() || '',
          height_cm: data.height_cm?.toString() || '',
          goals: data.goals || '',
          instagram_username: data.instagram_username || '',
          fitbit_user_id: data.fitbit_user_id,
          fitbit_connected_at: data.fitbit_connected_at,
          fitbit_last_sync_at: data.fitbit_last_sync_at,
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

  const handleConnectFitbit = async () => {
    setConnectingFitbit(true);
    try {
      const redirectUrl = `${window.location.origin}/fitbit/callback`;
      console.log('Calling fitbit-auth-start with redirectUrl:', redirectUrl);
      
      const { data, error } = await supabase.functions.invoke('fitbit-auth-start', {
        body: { redirectUrl },
      });

      console.log('Response:', { data, error });

      if (error) throw error;

      if (data.authUrl) {
        console.log('Redirecting to Fitbit...');
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authUrl received from server');
      }
    } catch (error: any) {
      console.error('Fitbit connect error:', error);
      toast.error('Fout bij verbinden met Fitbit: ' + error.message);
      setConnectingFitbit(false);
    }
  };

  const handleDisconnectFitbit = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          fitbit_user_id: null,
          fitbit_access_token: null,
          fitbit_refresh_token: null,
          fitbit_token_expires_at: null,
          fitbit_scope: null,
          fitbit_connected_at: null,
          fitbit_last_sync_at: null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Fitbit verbinding verbroken');
      loadProfile();
    } catch (error: any) {
      toast.error('Fout bij verbreken verbinding: ' + error.message);
    }
  };

  const handleSyncHistorical = async () => {
    setSyncingHistorical(true);
    try {
      const { data, error } = await supabase.functions.invoke('fitbit-sync-historical', {
        body: { days: 365 },
      });

      if (error) throw error;

      toast.success('Historische sync gestart! Dit draait in de achtergrond en kan 20-30 minuten duren. Je kunt de app gewoon blijven gebruiken.');
      loadProfile();
    } catch (error: any) {
      toast.error('Fout bij historische sync: ' + error.message);
    } finally {
      setSyncingHistorical(false);
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
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('theme.title')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-xs">{t('theme.light')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-xs">{t('theme.dark')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="text-xs">{t('theme.system')}</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {theme === 'system' 
                    ? 'Volgt je toestel instellingen' 
                    : `Momenteel in ${theme === 'dark' ? 'donker' : 'licht'} modus`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Fitbit Integratie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!profile.fitbit_user_id ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Verbind je Fitbit-account om stappen en verbranding automatisch in te laden.
                </p>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-xs font-medium">📋 Callback URL voor Fitbit:</p>
                  <code className="text-xs break-all block bg-background p-2 rounded border">
                    {window.location.origin}/fitbit/callback
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Voeg deze URL toe als "OAuth 2.0 Redirect URL" in je Fitbit Developer Dashboard
                  </p>
                </div>
                <Button 
                  onClick={handleConnectFitbit} 
                  disabled={connectingFitbit}
                  className="w-full"
                >
                  {connectingFitbit ? 'Verbinden...' : 'Verbind Fitbit'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">✓ Fitbit verbonden</p>
                  {profile.fitbit_connected_at && (
                    <p className="text-xs text-muted-foreground">
                      Sinds: {new Date(profile.fitbit_connected_at).toLocaleDateString('nl-NL')}
                    </p>
                  )}
                  {profile.fitbit_last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Laatst gesynchroniseerd: {new Date(profile.fitbit_last_sync_at).toLocaleString('nl-NL')}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-xs font-medium">📅 Historische gegevens importeren</p>
                  <p className="text-xs text-muted-foreground">
                    Importeer automatisch al je Fitbit data van de afgelopen 365 dagen (stappen, calorieën, gewicht, vetpercentage én slaap).
                  </p>
                  <Button
                    onClick={handleSyncHistorical}
                    disabled={syncingHistorical}
                    variant="secondary"
                    className="w-full"
                    size="sm"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {syncingHistorical ? 'Importeren...' : 'Importeer 365 dagen historie'}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnectFitbit}
                  className="w-full"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Verbinding verbreken
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('auth.fullName')}</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  required
                />
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
