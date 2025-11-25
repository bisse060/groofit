import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { format, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DailyLog {
  id: string;
  log_date: string;
  steps: number | null;
  workout_completed: boolean;
  calorie_intake: number | null;
  calorie_burn: number | null;
  weight: number | null;
  body_fat_percentage: number | null;
  notes: string | null;
  tags: string[] | null;
}

export default function DailyLogs() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentLog, setCurrentLog] = useState({
    steps: '',
    workout_completed: false,
    calorie_intake: '',
    calorie_burn: '',
    weight: '',
    body_fat_percentage: '',
    notes: '',
    tags: [] as string[],
  });

  useEffect(() => {
    if (user) {
      loadLogs();
      checkFitbitConnection();
    }
  }, [user]);

  useEffect(() => {
    loadLogForDate(selectedDate);
  }, [selectedDate, logs]);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('log_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLogForDate = (date: string) => {
    const log = logs.find((l) => l.log_date === date);
    if (log) {
      setCurrentLog({
        steps: log.steps?.toString() || '',
        workout_completed: log.workout_completed,
        calorie_intake: log.calorie_intake?.toString() || '',
        calorie_burn: log.calorie_burn?.toString() || '',
        weight: log.weight?.toString() || '',
        body_fat_percentage: log.body_fat_percentage?.toString() || '',
        notes: log.notes || '',
        tags: log.tags || [],
      });
    } else {
      setCurrentLog({
        steps: '',
        workout_completed: false,
        calorie_intake: '',
        calorie_burn: '',
        weight: '',
        body_fat_percentage: '',
        notes: '',
        tags: [],
      });
    }
  };

  const checkFitbitConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fitbit_user_id')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setFitbitConnected(!!data?.fitbit_user_id);
    } catch (error: any) {
      console.error('Error checking Fitbit connection:', error);
    }
  };

  const handleSyncFitbit = async () => {
    setSyncing(true);
    try {
      // Sync activity data (steps, calories, weight, body fat)
      const { data: activityData, error: activityError } = await supabase.functions.invoke('fitbit-sync-daily', {
        body: { date: selectedDate },
      });

      if (activityError) throw activityError;

      // Sync sleep data
      const { data: sleepData, error: sleepError } = await supabase.functions.invoke('fitbit-sync-sleep', {
        body: { userId: user?.id, date: selectedDate },
      });

      if (sleepError) {
        console.error('Sleep sync error:', sleepError);
      }

      if (activityData?.success) {
        let message = `Fitbit data gesynchroniseerd: ${activityData.steps} stappen, ${activityData.calories_out} calorieën`;
        
        if (activityData.weight) {
          message += `, gewicht: ${activityData.weight} kg`;
        }

        if (activityData.body_fat_percentage) {
          message += `, vet: ${activityData.body_fat_percentage}%`;
        }
        
        if (sleepData?.success && !sleepData.noData) {
          message += `, slaap: ${sleepData.duration_minutes} minuten`;
        }
        
        toast.success(message);
        
        setCurrentLog({
          ...currentLog,
          steps: activityData.steps.toString(),
          calorie_burn: activityData.calories_out.toString(),
          weight: activityData.weight ? activityData.weight.toString() : currentLog.weight,
          body_fat_percentage: activityData.body_fat_percentage ? activityData.body_fat_percentage.toString() : currentLog.body_fat_percentage,
        });
        loadLogs();
      }
    } catch (error: any) {
      toast.error('Fout bij synchroniseren: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handlePreviousDay = () => {
    const previousDate = subDays(new Date(selectedDate), 1);
    setSelectedDate(format(previousDate, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const nextDate = addDays(new Date(selectedDate), 1);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (format(nextDate, 'yyyy-MM-dd') <= today) {
      setSelectedDate(format(nextDate, 'yyyy-MM-dd'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('daily_logs').upsert(
        {
          user_id: user?.id,
          log_date: selectedDate,
          steps: currentLog.steps ? parseInt(currentLog.steps) : null,
          workout_completed: currentLog.workout_completed,
          calorie_intake: currentLog.calorie_intake ? parseInt(currentLog.calorie_intake) : null,
          calorie_burn: currentLog.calorie_burn ? parseInt(currentLog.calorie_burn) : null,
          weight: currentLog.weight ? parseFloat(currentLog.weight) : null,
          body_fat_percentage: currentLog.body_fat_percentage
            ? parseFloat(currentLog.body_fat_percentage)
            : null,
          notes: currentLog.notes,
          tags: currentLog.tags.length > 0 ? currentLog.tags : null,
        },
        { onConflict: 'user_id,log_date' }
      );

      if (error) throw error;

      toast.success('Log saved successfully!');
      loadLogs();
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('logs.title')}</h1>
            <p className="text-muted-foreground">Track your daily fitness activities</p>
          </div>
          {fitbitConnected && (
            <Button
              onClick={handleSyncFitbit}
              disabled={syncing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchroniseren...' : 'Sync met Fitbit'}
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Log Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">{t('logs.date')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handlePreviousDay}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleNextDay}
                      disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="steps">{t('logs.steps')}</Label>
                    <Input
                      id="steps"
                      type="number"
                      value={currentLog.steps}
                      onChange={(e) => setCurrentLog({ ...currentLog, steps: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox
                      id="workout"
                      checked={currentLog.workout_completed}
                      onCheckedChange={(checked) =>
                        setCurrentLog({ ...currentLog, workout_completed: checked as boolean })
                      }
                    />
                    <Label htmlFor="workout" className="cursor-pointer">
                      {t('logs.workout')} Completed
                    </Label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="calorie_intake">{t('logs.calorieIntake')}</Label>
                    <Input
                      id="calorie_intake"
                      type="number"
                      value={currentLog.calorie_intake}
                      onChange={(e) =>
                        setCurrentLog({ ...currentLog, calorie_intake: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calorie_burn">{t('logs.calorieBurn')}</Label>
                    <Input
                      id="calorie_burn"
                      type="number"
                      value={currentLog.calorie_burn}
                      onChange={(e) =>
                        setCurrentLog({ ...currentLog, calorie_burn: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="weight">{t('logs.weight')}</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={currentLog.weight}
                      onChange={(e) => setCurrentLog({ ...currentLog, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body_fat">{t('logs.bodyFat')}</Label>
                    <Input
                      id="body_fat"
                      type="number"
                      step="0.1"
                      value={currentLog.body_fat_percentage}
                      onChange={(e) =>
                        setCurrentLog({ ...currentLog, body_fat_percentage: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('logs.notes')}</Label>
                  <Textarea
                    id="notes"
                    value={currentLog.notes}
                    onChange={(e) => setCurrentLog({ ...currentLog, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                      {currentLog.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = currentLog.tags.filter((_, i) => i !== index);
                              setCurrentLog({ ...currentLog, tags: newTags });
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      id="tags"
                      placeholder="Typ een tag en druk op Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          const value = input.value.trim();
                          if (value && !currentLog.tags.includes(value)) {
                            setCurrentLog({ ...currentLog, tags: [...currentLog.tags, value] });
                            input.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="space-y-1">
                    <Button
                      variant={log.log_date === selectedDate ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedDate(log.log_date)}
                    >
                      {format(new Date(log.log_date), 'MMM dd, yyyy')}
                    </Button>
                    {log.tags && log.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-2">
                        {log.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
