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
import { format } from 'date-fns';

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
}

export default function DailyLogs() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  });

  useEffect(() => {
    if (user) {
      loadLogs();
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
      });
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
        <div>
          <h1 className="text-3xl font-bold">{t('logs.title')}</h1>
          <p className="text-muted-foreground">Track your daily fitness activities</p>
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
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
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
                  <Button
                    key={log.id}
                    variant={log.log_date === selectedDate ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedDate(log.log_date)}
                  >
                    {format(new Date(log.log_date), 'MMM dd, yyyy')}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
