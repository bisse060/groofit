import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, ArrowLeft, Calendar, Target, Weight, Ruler, Dumbbell, Moon, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Cycle {
  id: string;
  name: string | null;
  cycle_type: string | null;
  start_date: string;
  end_date: string | null;
  goal: string | null;
  notes: string | null;
  baseline_snapshot: any;
  created_at: string;
}

const CYCLE_TYPES = ['cut', 'bulk', 'maintenance', 'recomp', 'strength', 'custom'];

export default function Performance() {
  const { user } = useAuth();
  const { hasFlag, loading: flagsLoading } = useFeatureFlags();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newCycle, setNewCycle] = useState({
    name: '',
    cycle_type: 'bulk',
    start_date: new Date().toISOString().split('T')[0],
    goal: '',
    notes: '',
  });

  useEffect(() => {
    if (!flagsLoading && !hasFlag('cycle_support')) {
      navigate('/dashboard');
      return;
    }
    if (user && hasFlag('cycle_support')) {
      loadCycles();
    }
  }, [user, flagsLoading]);

  const loadCycles = async () => {
    const { data, error } = await supabase
      .from('performance_cycles')
      .select('*')
      .eq('user_id', user!.id)
      .order('start_date', { ascending: false });

    if (!error) setCycles(data || []);
    setLoading(false);
  };

  const loadCurrentData = async () => {
    if (!user) return null;

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [profileRes, measurementRes, sleepRes, dailyLogsRes, workoutsRes] = await Promise.all([
      supabase.from('profiles').select('current_weight').eq('id', user.id).single(),
      supabase.from('measurements').select('*').eq('user_id', user.id).order('measurement_date', { ascending: false }).limit(1),
      supabase.from('sleep_logs').select('score').eq('user_id', user.id).gte('date', thirtyDaysAgoStr).lte('date', today),
      supabase.from('daily_logs').select('body_fat_percentage').eq('user_id', user.id).order('log_date', { ascending: false }).limit(1),
      supabase.from('workouts').select('id, date').eq('user_id', user.id).eq('is_template', false).gte('date', thirtyDaysAgoStr).lte('date', today),
    ]);

    const latestMeasurement = measurementRes.data?.[0];
    const sleepScores = sleepRes.data?.filter(s => s.score != null).map(s => s.score!) || [];
    const avgSleep = sleepScores.length > 0 ? sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length : null;

    let totalVolume = 0;
    if (workoutsRes.data && workoutsRes.data.length > 0) {
      const workoutIds = workoutsRes.data.map(w => w.id);
      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('id')
        .in('workout_id', workoutIds);

      if (exercises && exercises.length > 0) {
        const { data: sets } = await supabase
          .from('workout_sets')
          .select('weight, reps')
          .in('workout_exercise_id', exercises.map(e => e.id))
          .eq('completed', true);

        totalVolume = (sets || []).reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
      }
    }

    return {
      weight: profileRes.data?.current_weight || latestMeasurement?.weight || null,
      bodyfat: dailyLogsRes.data?.[0]?.body_fat_percentage || null,
      chest: latestMeasurement?.chest_cm || null,
      waist: latestMeasurement?.waist_cm || null,
      hips: latestMeasurement?.hips_cm || null,
      sleep_avg_30d: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
      energy_avg_30d: null,
      training_volume_30d: totalVolume,
    };
  };

  const handleCreateCycle = async () => {
    if (!user) return;

    const activeCycle = cycles.find(c => !c.end_date);
    if (activeCycle) {
      toast.error('Sluit eerst je huidige cycle af voordat je een nieuwe start.');
      return;
    }

    setSaving(true);
    const baseline = await loadCurrentData();

    const { error } = await supabase
      .from('performance_cycles')
      .insert({
        user_id: user.id,
        name: newCycle.name || null,
        cycle_type: newCycle.cycle_type,
        start_date: newCycle.start_date,
        goal: newCycle.goal || null,
        notes: newCycle.notes || null,
        baseline_snapshot: baseline,
      });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Cycle gestart!');
      setShowNewForm(false);
      setNewCycle({ name: '', cycle_type: 'bulk', start_date: new Date().toISOString().split('T')[0], goal: '', notes: '' });
      loadCycles();
    }
    setSaving(false);
  };

  const handleEndCycle = async (cycleId: string) => {
    const { error } = await supabase
      .from('performance_cycles')
      .update({ end_date: new Date().toISOString().split('T')[0] })
      .eq('id', cycleId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Cycle afgesloten!');
      loadCycles();
      setSelectedCycle(null);
    }
  };

  const handleUpdateCycle = async (cycleId: string, updates: Partial<Cycle>) => {
    const { error } = await supabase
      .from('performance_cycles')
      .update(updates)
      .eq('id', cycleId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Cycle bijgewerkt!');
      loadCycles();
      // Update selected cycle in place
      if (selectedCycle?.id === cycleId) {
        setSelectedCycle(prev => prev ? { ...prev, ...updates } : null);
      }
    }
  };

  if (flagsLoading || loading) {
    return <Layout><div className="flex items-center justify-center min-h-[400px]"><p>{t('common.loading')}</p></div></Layout>;
  }

  if (selectedCycle) {
    return (
      <CycleDetail
        cycle={selectedCycle}
        onBack={() => { setSelectedCycle(null); loadCycles(); }}
        onEnd={handleEndCycle}
        onUpdate={handleUpdateCycle}
        userId={user!.id}
      />
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cycle Support</h1>
            <p className="text-muted-foreground text-sm">Track je cut, bulk en maintenance fases</p>
          </div>
          <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nieuwe Cycle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Nieuwe Cycle</DialogTitle>
              </DialogHeader>
              <CycleForm
                values={newCycle}
                onChange={setNewCycle}
                onSubmit={handleCreateCycle}
                saving={saving}
                submitLabel="Start Cycle"
              />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="cycles">
          <TabsList>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="cycles" className="space-y-3 mt-4">
            {cycles.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nog geen cycles. Start je eerste cycle!</CardContent></Card>
            ) : (
              cycles.map(cycle => (
                <CycleCard key={cycle.id} cycle={cycle} onClick={() => setSelectedCycle(cycle)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <Card><CardContent className="p-8 text-center text-muted-foreground">Insights worden beschikbaar na je eerste afgesloten cycle.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// Shared form component for create and edit
function CycleForm({ values, onChange, onSubmit, saving, submitLabel, showEndDate }: {
  values: { name: string; cycle_type: string; start_date: string; end_date?: string; goal: string; notes: string };
  onChange: (v: any) => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
  showEndDate?: boolean;
}) {
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Naam</Label>
        <Input value={values.name} onChange={e => onChange((p: any) => ({ ...p, name: e.target.value }))} placeholder="Bijv. Winter Bulk 2026" />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={values.cycle_type} onValueChange={v => onChange((p: any) => ({ ...p, cycle_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CYCLE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Startdatum</Label>
        <Input type="date" value={values.start_date} onChange={e => onChange((p: any) => ({ ...p, start_date: e.target.value }))} />
      </div>
      {showEndDate && (
        <div className="space-y-2">
          <Label>Einddatum</Label>
          <Input type="date" value={values.end_date || ''} onChange={e => onChange((p: any) => ({ ...p, end_date: e.target.value || undefined }))} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Doel</Label>
        <Input value={values.goal} onChange={e => onChange((p: any) => ({ ...p, goal: e.target.value }))} placeholder="Bijv. +5kg lean mass" />
      </div>
      <div className="space-y-2">
        <Label>Notities</Label>
        <Textarea value={values.notes} onChange={e => onChange((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Optionele notities..." />
      </div>
      <Button onClick={onSubmit} disabled={saving} className="w-full">
        {saving ? 'Bezig...' : submitLabel}
      </Button>
    </div>
  );
}

function CycleCard({ cycle, onClick }: { cycle: Cycle; onClick: () => void }) {
  const isActive = !cycle.end_date;

  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{cycle.name || 'Naamloze cycle'}</h3>
            <Badge variant={isActive ? 'default' : 'secondary'} className="capitalize">
              {cycle.cycle_type}
            </Badge>
            {isActive && <Badge variant="outline" className="border-primary text-primary">Actief</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(cycle.start_date), 'dd/MM/yyyy')}
            {cycle.end_date && ` – ${format(new Date(cycle.end_date), 'dd/MM/yyyy')}`}
          </div>
          {cycle.goal && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {cycle.goal}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaCard({ label, value, unit, icon: Icon, baseline, current, peak, peakLabel }: {
  label: string; value: number | null; unit: string; icon: any;
  baseline?: number | null; current?: number | null;
  peak?: number | null; peakLabel?: string;
}) {
  if (value == null && baseline == null && current == null) return null;

  const isPositive = value != null && value > 0;
  const isZero = value === 0;
  const hasComparison = value != null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        {hasComparison ? (
          <div className={`text-xl font-bold ${isZero ? 'text-muted-foreground' : isPositive ? 'text-primary' : 'text-destructive'}`}>
            {isPositive ? '+' : ''}{Math.round(value * 10) / 10}{unit}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Geen data</div>
        )}
        {(baseline != null || current != null) && (
          <div className="text-[10px] text-muted-foreground mt-1">
            {baseline != null && <span>Start: {Math.round(baseline * 10) / 10}{unit}</span>}
            {baseline != null && current != null && <span> → </span>}
            {current != null && <span>Nu: {Math.round(current * 10) / 10}{unit}</span>}
          </div>
        )}
        {peak != null && peak !== current && (
          <div className="text-[10px] text-primary/70 mt-0.5">
            {peakLabel || 'Piek'}: {Math.round(peak * 10) / 10}{unit}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CycleDetail({ cycle: initialCycle, onBack, onEnd, onUpdate, userId }: {
  cycle: Cycle; onBack: () => void; onEnd: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Cycle>) => Promise<void>;
  userId: string;
}) {
  const [cycle, setCycle] = useState(initialCycle);
  const [currentData, setCurrentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    name: cycle.name || '',
    cycle_type: cycle.cycle_type || 'bulk',
    start_date: cycle.start_date,
    end_date: cycle.end_date || '',
    goal: cycle.goal || '',
    notes: cycle.notes || '',
  });

  const baseline = cycle.baseline_snapshot || {};
  const isActive = !cycle.end_date;

  useEffect(() => {
    loadCurrent();
  }, []);

  // Sync cycle from parent updates
  useEffect(() => {
    setCycle(initialCycle);
  }, [initialCycle]);

  const handleSaveEdit = async () => {
    setEditSaving(true);
    await onUpdate(cycle.id, {
      name: editValues.name || null,
      cycle_type: editValues.cycle_type,
      start_date: editValues.start_date,
      end_date: editValues.end_date || null,
      goal: editValues.goal || null,
      notes: editValues.notes || null,
    });
    setCycle(prev => ({
      ...prev,
      name: editValues.name || null,
      cycle_type: editValues.cycle_type,
      start_date: editValues.start_date,
      end_date: editValues.end_date || null,
      goal: editValues.goal || null,
      notes: editValues.notes || null,
    }));
    setEditSaving(false);
    setShowEdit(false);
  };

  const loadCurrent = async () => {
    const endDate = cycle.end_date || new Date().toISOString().split('T')[0];

    // Fetch ALL measurements during cycle for peak/trend analysis
    const [allMeasurementsRes, sleepRes, workoutsRes] = await Promise.all([
      supabase.from('measurements').select('*').eq('user_id', userId).gt('measurement_date', cycle.start_date).lte('measurement_date', endDate).order('measurement_date', { ascending: false }),
      supabase.from('sleep_logs').select('score').eq('user_id', userId).gte('date', cycle.start_date).lte('date', endDate),
      supabase.from('workouts').select('id').eq('user_id', userId).eq('is_template', false).gte('date', cycle.start_date).lte('date', endDate),
    ]);

    const allMeasurements = allMeasurementsRes.data || [];
    const latestMeasurement = allMeasurements[0] || null;

    // Calculate peak values during cycle
    const peakWeight = allMeasurements.reduce((max, m) => m.weight != null && (max == null || Number(m.weight) > max) ? Number(m.weight) : max, null as number | null);
    const peakChest = allMeasurements.reduce((max, m) => m.chest_cm != null && (max == null || Number(m.chest_cm) > max) ? Number(m.chest_cm) : max, null as number | null);
    const minWaist = allMeasurements.reduce((min, m) => m.waist_cm != null && (min == null || Number(m.waist_cm) < min) ? Number(m.waist_cm) : min, null as number | null);

    const sleepScores = sleepRes.data?.filter(s => s.score != null).map(s => s.score!) || [];
    const avgSleep = sleepScores.length > 0 ? sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length : null;

    let cycleVolume = 0;
    if (workoutsRes.data && workoutsRes.data.length > 0) {
      const workoutIds = workoutsRes.data.map(w => w.id);
      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('id')
        .in('workout_id', workoutIds);

      if (exercises && exercises.length > 0) {
        const { data: sets } = await supabase
          .from('workout_sets')
          .select('weight, reps')
          .in('workout_exercise_id', exercises.map(e => e.id))
          .eq('completed', true);

        cycleVolume = (sets || []).reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
      }
    }

    const startDate = new Date(cycle.start_date);
    const end = new Date(endDate);
    const daysInCycle = Math.max(1, Math.ceil((end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    setCurrentData({
      weight: latestMeasurement?.weight != null ? Number(latestMeasurement.weight) : null,
      chest: latestMeasurement?.chest_cm != null ? Number(latestMeasurement.chest_cm) : null,
      waist: latestMeasurement?.waist_cm != null ? Number(latestMeasurement.waist_cm) : null,
      hips: latestMeasurement?.hips_cm != null ? Number(latestMeasurement.hips_cm) : null,
      shoulder: latestMeasurement?.shoulder_cm != null ? Number(latestMeasurement.shoulder_cm) : null,
      peak_weight: peakWeight,
      peak_chest: peakChest,
      min_waist: minWaist,
      measurement_count: allMeasurements.length,
      sleep_avg: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
      training_volume: cycleVolume,
      daily_volume: cycleVolume / daysInCycle,
    });
    setLoading(false);
  };

  const weightDelta = currentData?.weight != null && baseline.weight != null ? currentData.weight - baseline.weight : null;
  const chestDelta = currentData?.chest != null && baseline.chest != null ? currentData.chest - baseline.chest : null;
  const waistDelta = currentData?.waist != null && baseline.waist != null ? currentData.waist - baseline.waist : null;
  const hipsDelta = currentData?.hips != null && baseline.hips != null ? currentData.hips - baseline.hips : null;

  const baselineDaily = baseline.training_volume_30d ? baseline.training_volume_30d / 30 : null;
  const volumeChange = baselineDaily && currentData?.daily_volume
    ? ((currentData.daily_volume - baselineDaily) / baselineDaily) * 100
    : null;

  const sleepDelta = currentData?.sleep_avg != null && baseline.sleep_avg_30d != null
    ? currentData.sleep_avg - baseline.sleep_avg_30d
    : null;

  const hasAnyDelta = weightDelta != null || chestDelta != null || waistDelta != null || hipsDelta != null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{cycle.name || 'Cycle'}</h1>
              <Badge className="capitalize">{cycle.cycle_type}</Badge>
              {isActive && <Badge variant="outline" className="border-primary text-primary">Actief</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(cycle.start_date), 'dd/MM/yyyy')}
              {cycle.end_date ? ` – ${format(new Date(cycle.end_date), 'dd/MM/yyyy')}` : ' – heden'}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon"><Pencil className="h-4 w-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cycle Bewerken</DialogTitle>
                </DialogHeader>
                <CycleForm
                  values={editValues}
                  onChange={setEditValues}
                  onSubmit={handleSaveEdit}
                  saving={editSaving}
                  submitLabel="Opslaan"
                  showEndDate={true}
                />
              </DialogContent>
            </Dialog>
            {isActive && (
              <Button variant="outline" onClick={() => onEnd(cycle.id)}>Afsluiten</Button>
            )}
          </div>
        </div>

        {cycle.goal && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Doel: {cycle.goal}</span>
            </CardContent>
          </Card>
        )}

        {/* Baseline Snapshot */}
        {Object.keys(baseline).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Baseline Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                {baseline.weight != null && <div>Gewicht: {baseline.weight} kg</div>}
                {baseline.chest != null && <div>Borst: {baseline.chest} cm</div>}
                {baseline.waist != null && <div>Taille: {baseline.waist} cm</div>}
                {baseline.hips != null && <div>Heupen: {baseline.hips} cm</div>}
                {baseline.bodyfat != null && <div>Vetpercentage: {baseline.bodyfat}%</div>}
                {baseline.sleep_avg_30d != null && <div>Slaapscore (30d): {baseline.sleep_avg_30d}</div>}
                {baseline.training_volume_30d != null && <div>Volume (30d): {Math.round(baseline.training_volume_30d)} kg</div>}
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Data laden...</div>
        ) : (
          <>
            {/* Body Changes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Lichamelijke Veranderingen</h2>
                {currentData?.measurement_count > 0 && (
                  <span className="text-xs text-muted-foreground">{currentData.measurement_count} meting(en) in cycle</span>
                )}
              </div>
              {hasAnyDelta ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DeltaCard label="Gewicht" value={weightDelta} unit=" kg" icon={Weight} baseline={baseline.weight} current={currentData?.weight} peak={currentData?.peak_weight} peakLabel="Hoogste" />
                  <DeltaCard label="Borst" value={chestDelta} unit=" cm" icon={Ruler} baseline={baseline.chest} current={currentData?.chest} peak={currentData?.peak_chest} peakLabel="Hoogste" />
                  <DeltaCard label="Taille" value={waistDelta} unit=" cm" icon={Ruler} baseline={baseline.waist} current={currentData?.waist} peak={currentData?.min_waist} peakLabel="Laagste" />
                  <DeltaCard label="Heupen" value={hipsDelta} unit=" cm" icon={Ruler} baseline={baseline.hips} current={currentData?.hips} />
                </div>
              ) : (
                <Card><CardContent className="p-4 text-sm text-muted-foreground">
                  Geen baseline of huidige meetdata beschikbaar. Voeg metingen toe om veranderingen te zien.
                </CardContent></Card>
              )}
            </div>

            {/* Training Impact */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Training Impact</h2>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Dumbbell className="h-4 w-4" />
                    <span className="text-xs">Volume verandering</span>
                  </div>
                  {volumeChange != null ? (
                    <div className={`text-xl font-bold ${volumeChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {volumeChange >= 0 ? '+' : ''}{Math.round(volumeChange)}% trainingsvolume
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {currentData?.training_volume > 0
                        ? `Volume deze cycle: ${Math.round(currentData.training_volume)} kg (geen baseline voor vergelijking)`
                        : 'Geen workoutdata in deze periode.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Wellbeing */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Welzijn Impact</h2>
              <div className="grid grid-cols-2 gap-3">
                <DeltaCard label="Slaapscore" value={sleepDelta} unit="" icon={Moon} baseline={baseline.sleep_avg_30d} current={currentData?.sleep_avg} />
              </div>
              {sleepDelta == null && (
                <Card className="mt-2"><CardContent className="p-4 text-sm text-muted-foreground">
                  {currentData?.sleep_avg != null
                    ? `Gemiddelde slaapscore: ${currentData.sleep_avg} (geen baseline voor vergelijking)`
                    : 'Geen slaapdata beschikbaar in deze periode.'}
                </CardContent></Card>
              )}
            </div>

            {/* Summary for ended cycles */}
            {!isActive && hasAnyDelta && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">Cycle Samenvatting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {weightDelta != null && <p>{weightDelta >= 0 ? '+' : ''}{Math.round(weightDelta * 10) / 10} kg gewicht</p>}
                  {chestDelta != null && <p>{chestDelta >= 0 ? '+' : ''}{Math.round(chestDelta * 10) / 10} cm borst</p>}
                  {waistDelta != null && <p>{waistDelta >= 0 ? '+' : ''}{Math.round(waistDelta * 10) / 10} cm taille</p>}
                  {volumeChange != null && <p>{volumeChange >= 0 ? '+' : ''}{Math.round(volumeChange)}% trainingsvolume</p>}
                  {sleepDelta != null && <p>{sleepDelta >= 0 ? '+' : ''}{Math.round(sleepDelta * 10) / 10} slaapscore</p>}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {cycle.notes && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-1">Notities</h3>
              <p className="text-sm text-muted-foreground">{cycle.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
