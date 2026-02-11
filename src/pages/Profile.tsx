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
import { Moon, Sun, Monitor, Activity, Unlink, Crown, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { tier, tierName, loading: tierLoading } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    current_weight: '',
    target_weight: '',
    height_cm: '',
    goals: '',
    instagram_username: '',
  });
  const [fitbitCredentials, setFitbitCredentials] = useState({
    fitbit_user_id: null as string | null,
    connected_at: null as string | null,
    last_sync_at: null as string | null,
  });
  const [connectingFitbit, setConnectingFitbit] = useState(false);
  const [syncingHistorical, setSyncingHistorical] = useState(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [fatsecretCredentials, setFatsecretCredentials] = useState({
    fatsecret_user_id: null as string | null,
    connected_at: null as string | null,
    last_sync_at: null as string | null,
  });
  const [connectingFatsecret, setConnectingFatsecret] = useState(false);
  const [syncingFatsecret, setSyncingFatsecret] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  // Poll sync progress every 30 seconds if a sync is in progress
  useEffect(() => {
    if (!syncProgress || syncProgress.status !== 'in_progress') {
      return;
    }

    const interval = setInterval(async () => {
      const { data: progress } = await supabase
        .from('fitbit_sync_progress')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (progress) {
        setSyncProgress(progress);
        
        // Reload profile when sync completes
        if (progress.status === 'completed') {
          loadProfile();
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [syncProgress, user?.id]);

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
        });
      }

      // Load Fitbit credentials via secure RPC (tokens not exposed)
      const { data: credentials } = await supabase
        .rpc('get_fitbit_connection_status', { p_user_id: user?.id })
        .single();

      if (credentials) {
        setFitbitCredentials({
          fitbit_user_id: credentials.fitbit_user_id,
          connected_at: credentials.connected_at,
          last_sync_at: credentials.last_sync_at,
        });

        // Load sync progress if user has Fitbit connected
        const { data: progress } = await supabase
          .from('fitbit_sync_progress')
          .select('*')
          .eq('user_id', user?.id)
          .single();
        
        setSyncProgress(progress);
      }

      // Load FatSecret credentials via secure RPC
      const { data: fsCredsArr, error: fsError } = await supabase
        .rpc('get_fatsecret_connection_status', { p_user_id: user?.id });

      if (fsError) throw fsError;

      const fsCreds = Array.isArray(fsCredsArr) ? fsCredsArr[0] : fsCredsArr;

      if (fsCreds) {
        setFatsecretCredentials({
          fatsecret_user_id: fsCreds.fatsecret_user_id,
          connected_at: fsCreds.connected_at,
          last_sync_at: fsCreds.last_sync_at,
        });
      } else {
        setFatsecretCredentials({ fatsecret_user_id: null, connected_at: null, last_sync_at: null });
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
      // Always use the published URL for Fitbit OAuth redirect
      const redirectUrl = 'https://groofit.lovable.app/fitbit/callback';
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
        .from('fitbit_credentials')
        .delete()
        .eq('user_id', user?.id);

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

  const handleConnectFatsecret = async () => {
    setConnectingFatsecret(true);
    try {
      const callbackUrl = 'https://groofit.lovable.app/fatsecret/callback';
      const { data, error } = await supabase.functions.invoke('fatsecret-auth-start', {
        body: { callbackUrl },
      });

      if (error) throw error;

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authUrl received');
      }
    } catch (error: any) {
      console.error('FatSecret connect error:', error);
      toast.error('Fout bij verbinden met FatSecret: ' + error.message);
      setConnectingFatsecret(false);
    }
  };

  const handleDisconnectFatsecret = async () => {
    try {
      const { error } = await supabase
        .from('fatsecret_credentials')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setFatsecretCredentials({ fatsecret_user_id: null, connected_at: null, last_sync_at: null });
      toast.success('FatSecret verbinding verbroken');
    } catch (error: any) {
      toast.error('Fout bij verbreken verbinding: ' + error.message);
    }
  };

  const handleSyncFatsecret = async () => {
    setSyncingFatsecret(true);
    try {
      const { data, error } = await supabase.functions.invoke('fatsecret-sync-food', {
        body: {},
      });

      if (error) throw error;

      toast.success(`Voeding gesynchroniseerd: ${data.synced} items`);
      loadProfile();
    } catch (error: any) {
      toast.error('Fout bij synchroniseren: ' + error.message);
    } finally {
      setSyncingFatsecret(false);
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
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Beheer je profielinformatie</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={tier?.name === 'tester' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                {tierName}
              </Badge>
              {tier?.description && (
                <span className="text-sm text-muted-foreground">{tier.description}</span>
              )}
            </div>
          </CardContent>
        </Card>

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
            {!fitbitCredentials.fitbit_user_id ? (
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
                  {fitbitCredentials.connected_at && (
                    <p className="text-xs text-muted-foreground">
                      Sinds: {new Date(fitbitCredentials.connected_at).toLocaleDateString('nl-NL')}
                    </p>
                  )}
                  {fitbitCredentials.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Laatst gesynchroniseerd: {new Date(fitbitCredentials.last_sync_at).toLocaleString('nl-NL')}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-xs font-medium">📅 Historische gegevens importeren</p>
                  <p className="text-xs text-muted-foreground">
                    Importeer automatisch al je Fitbit data van de afgelopen 365 dagen. Data wordt gesynchroniseerd met max 30 dagen per uur om binnen API limieten te blijven.
                  </p>
                  
                  {syncProgress && syncProgress.status === 'in_progress' && (
                    <div className="space-y-2 p-2 bg-background rounded border">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium">Voortgang:</span>
                        <span>{syncProgress.days_synced} / {syncProgress.total_days} dagen</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(syncProgress.days_synced / syncProgress.total_days) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Geschatte tijd: ~{Math.ceil((syncProgress.total_days - syncProgress.days_synced) / 30)} uur
                      </p>
                    </div>
                  )}
                  
                  {syncProgress && syncProgress.status === 'completed' && (
                    <div className="p-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded text-xs">
                      ✓ Import voltooid! Alle {syncProgress.total_days} dagen zijn gesynchroniseerd.
                    </div>
                  )}
                  
                  <Button
                    onClick={handleSyncHistorical}
                    disabled={syncingHistorical || (syncProgress?.status === 'in_progress')}
                    variant="secondary"
                    className="w-full"
                    size="sm"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {syncingHistorical ? 'Opstarten...' : 
                     syncProgress?.status === 'in_progress' ? 'Import bezig...' :
                     syncProgress?.status === 'completed' ? 'Opnieuw importeren' :
                     'Importeer 365 dagen historie'}
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
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              FatSecret Integratie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!fatsecretCredentials.connected_at ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Verbind je FatSecret-account om je voedingsdagboek automatisch te synchroniseren.
                </p>
                <Button
                  onClick={handleConnectFatsecret}
                  disabled={connectingFatsecret}
                  className="w-full"
                >
                  {connectingFatsecret ? 'Verbinden...' : 'Verbind FatSecret'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">✓ FatSecret verbonden</p>
                  {fatsecretCredentials.connected_at && (
                    <p className="text-xs text-muted-foreground">
                      Sinds: {new Date(fatsecretCredentials.connected_at).toLocaleDateString('nl-NL')}
                    </p>
                  )}
                  {fatsecretCredentials.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Laatst gesynchroniseerd: {new Date(fatsecretCredentials.last_sync_at).toLocaleString('nl-NL')}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Je voedingsdagboek wordt dagelijks automatisch gesynchroniseerd. Calorieën worden bijgewerkt in je dagelijkse logs.
                </p>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleSyncFatsecret}
                  disabled={syncingFatsecret}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncingFatsecret ? 'animate-spin' : ''}`} />
                  {syncingFatsecret ? 'Synchroniseren...' : 'Nu synchroniseren'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnectFatsecret}
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
