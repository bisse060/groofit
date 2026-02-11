import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WeightData {
  date: string;
  weight: number;
  source: 'fitbit' | 'measurement';
}

type Period = '30' | '60' | '90';

export default function WeightTrendChart() {
  const { user } = useAuth();
  const [data, setData] = useState<WeightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30');
  const [dataSource, setDataSource] = useState<'fitbit' | 'measurement' | 'none'>('none');

  useEffect(() => {
    if (user) {
      loadWeightData();
    }
  }, [user]);

  const loadWeightData = async () => {
    try {
      setLoading(true);

      // 1. Try Fitbit data first (daily_logs with weight from Fitbit)
      const { data: fitbitLogs, error: fitbitError } = await supabase
        .from('daily_logs')
        .select('log_date, weight')
        .eq('user_id', user?.id)
        .eq('synced_from_fitbit', true)
        .not('weight', 'is', null)
        .order('log_date', { ascending: true });

      if (!fitbitError && fitbitLogs && fitbitLogs.length > 0) {
        setData(fitbitLogs.map(l => ({
          date: l.log_date,
          weight: Number(l.weight),
          source: 'fitbit' as const,
        })));
        setDataSource('fitbit');
        return;
      }

      // 2. Fallback to manual measurements
      const { data: measurements, error } = await supabase
        .from('measurements')
        .select('measurement_date, weight')
        .eq('user_id', user?.id)
        .not('weight', 'is', null)
        .order('measurement_date', { ascending: true });

      if (error) throw error;

      if (measurements && measurements.length > 0) {
        setData(measurements.map(m => ({
          date: m.measurement_date,
          weight: Number(m.weight),
          source: 'measurement' as const,
        })));
        setDataSource('measurement');
      } else {
        setDataSource('none');
      }
    } catch (error) {
      console.error('Error loading weight data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    const days = parseInt(period);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return data.filter(item => new Date(item.date) >= cutoffDate);
  };

  const filteredData = getFilteredData();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse space-y-3 w-full">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-[160px] bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium">Gewicht</p>
          </div>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Geen metingen voor deze periode
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Gewicht</CardTitle>
          </div>
          {dataSource === 'fitbit' && (
            <Badge variant="secondary" className="text-[10px]">Fitbit</Badge>
          )}
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="30" className="text-xs">30d</TabsTrigger>
            <TabsTrigger value="60" className="text-xs">60d</TabsTrigger>
            <TabsTrigger value="90" className="text-xs">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={filteredData}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.5}
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => format(new Date(date), 'dd/MM')}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis 
              domain={['dataMin - 1', 'dataMax + 1']}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip 
              labelFormatter={(date) => format(new Date(date), 'dd MMM yyyy')}
              formatter={(value: number) => [`${value} kg`, 'Gewicht']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="weight" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
