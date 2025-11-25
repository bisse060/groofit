import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface WeightData {
  date: string;
  weight: number;
}

type Period = '30' | '60' | '90';

export default function WeightTrendChart() {
  const { user } = useAuth();
  const [data, setData] = useState<WeightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30');

  useEffect(() => {
    if (user) {
      loadWeightData();
    }
  }, [user]);

  const loadWeightData = async () => {
    try {
      setLoading(true);
      const { data: measurements, error } = await supabase
        .from('measurements')
        .select('measurement_date, weight')
        .eq('user_id', user?.id)
        .not('weight', 'is', null)
        .order('measurement_date', { ascending: true });

      if (error) throw error;

      if (measurements) {
        const formattedData = measurements.map(m => ({
          date: m.measurement_date,
          weight: Number(m.weight),
        }));
        setData(formattedData);
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
        <CardHeader>
          <CardTitle>Gewichtsverloop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Laden...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gewichtsverloop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Geen gewichtsmetingen gevonden voor deze periode
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gewichtsverloop</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="30">30 dagen</TabsTrigger>
            <TabsTrigger value="60">60 dagen</TabsTrigger>
            <TabsTrigger value="90">90 dagen</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => format(new Date(date), 'dd/MM')}
              className="text-muted-foreground"
            />
            <YAxis 
              domain={['dataMin - 1', 'dataMax + 1']}
              className="text-muted-foreground"
            />
            <Tooltip 
              labelFormatter={(date) => format(new Date(date), 'dd MMM yyyy')}
              formatter={(value: number) => [`${value} kg`, 'Gewicht']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="weight" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}