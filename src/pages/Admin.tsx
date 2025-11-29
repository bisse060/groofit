import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Users, Activity, TrendingUp, Trash2, Eye, Dumbbell, Moon } from 'lucide-react';
import { format } from 'date-fns';

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLogs: 0,
    totalMeasurements: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<{
    measurements: any[];
    dailyLogs: any[];
    workouts: any[];
    sleepLogs: any[];
  }>({
    measurements: [],
    dailyLogs: [],
    workouts: [],
    sleepLogs: [],
  });

  useEffect(() => {
    if (user && isAdmin) {
      loadAdminStats();
      loadUsers();
      loadMeasurements();
    }
  }, [user, isAdmin]);

  const loadAdminStats = async () => {
    try {
      const [profilesRes, logsRes, measurementsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('daily_logs').select('id', { count: 'exact', head: true }),
        supabase.from('measurements').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: profilesRes.count || 0,
        totalLogs: logsRes.count || 0,
        totalMeasurements: measurementsRes.count || 0,
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, created_at, current_weight, target_weight, height_cm, goals, instagram_username')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const [measurementsRes, logsRes, workoutsRes, sleepRes] = await Promise.all([
        supabase
          .from('measurements')
          .select('*')
          .eq('user_id', userId)
          .order('measurement_date', { ascending: false }),
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userId)
          .order('log_date', { ascending: false })
          .limit(50),
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('sleep_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(30),
      ]);

      setUserDetails({
        measurements: measurementsRes.data || [],
        dailyLogs: logsRes.data || [],
        workouts: workoutsRes.data || [],
        sleepLogs: sleepRes.data || [],
      });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const loadMeasurements = async () => {
    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('id, user_id, measurement_date, weight, profiles(full_name)')
        .order('measurement_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      
      toast.success('User deleted successfully');
      loadUsers();
      loadAdminStats();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteMeasurement = async (measurementId: string) => {
    try {
      const { error } = await supabase.from('measurements').delete().eq('id', measurementId);
      if (error) throw error;
      
      toast.success('Measurement deleted successfully');
      loadMeasurements();
      loadAdminStats();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-destructive">Access denied. Admin only.</p>
        </div>
      </Layout>
    );
  }

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.admin')}</h1>
          <p className="text-muted-foreground">System overview and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLogs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Measurements</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMeasurements}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Height</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.current_weight ? `${u.current_weight} kg` : '-'}</TableCell>
                    <TableCell>{u.target_weight ? `${u.target_weight} kg` : '-'}</TableCell>
                    <TableCell>{u.height_cm ? `${u.height_cm} cm` : '-'}</TableCell>
                    <TableCell>{format(new Date(u.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u);
                                loadUserDetails(u.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle>{selectedUser?.full_name}</SheetTitle>
                              <SheetDescription>
                                Account details en activiteit
                              </SheetDescription>
                            </SheetHeader>
                            
                            <div className="mt-6 space-y-6">
                              {/* Profile Info */}
                              <div className="space-y-2">
                                <h3 className="font-semibold">Profiel Informatie</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Huidige Gewicht:</span>
                                    <p className="font-medium">{selectedUser?.current_weight || '-'} kg</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Doel Gewicht:</span>
                                    <p className="font-medium">{selectedUser?.target_weight || '-'} kg</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Lengte:</span>
                                    <p className="font-medium">{selectedUser?.height_cm || '-'} cm</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Instagram:</span>
                                    <p className="font-medium">{selectedUser?.instagram_username || '-'}</p>
                                  </div>
                                  {selectedUser?.goals && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Doelen:</span>
                                      <p className="font-medium">{selectedUser.goals}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Tabs for different data */}
                              <Tabs defaultValue="measurements" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="measurements">Metingen</TabsTrigger>
                                  <TabsTrigger value="logs">Logs</TabsTrigger>
                                  <TabsTrigger value="workouts">Workouts</TabsTrigger>
                                  <TabsTrigger value="sleep">Slaap</TabsTrigger>
                                </TabsList>

                                <TabsContent value="measurements" className="space-y-2">
                                  <h4 className="font-semibold text-sm">Metingen ({userDetails.measurements.length})</h4>
                                  <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {userDetails.measurements.map((m) => (
                                      <Card key={m.id}>
                                        <CardContent className="p-4">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium">{format(new Date(m.measurement_date), 'dd/MM/yyyy')}</span>
                                            {m.weight && <span className="text-sm">{m.weight} kg</span>}
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            {m.chest_cm && <div>Borst: {m.chest_cm} cm</div>}
                                            {m.waist_cm && <div>Taille: {m.waist_cm} cm</div>}
                                            {m.hips_cm && <div>Heupen: {m.hips_cm} cm</div>}
                                            {m.shoulder_cm && <div>Schouders: {m.shoulder_cm} cm</div>}
                                            {m.bicep_left_cm && <div>Bicep L: {m.bicep_left_cm} cm</div>}
                                            {m.bicep_right_cm && <div>Bicep R: {m.bicep_right_cm} cm</div>}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                    {userDetails.measurements.length === 0 && (
                                      <p className="text-sm text-muted-foreground">Geen metingen gevonden</p>
                                    )}
                                  </div>
                                </TabsContent>

                                <TabsContent value="logs" className="space-y-2">
                                  <h4 className="font-semibold text-sm">Daily Logs ({userDetails.dailyLogs.length})</h4>
                                  <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {userDetails.dailyLogs.map((log) => (
                                      <Card key={log.id}>
                                        <CardContent className="p-4">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium">{format(new Date(log.log_date), 'dd/MM/yyyy')}</span>
                                            <Activity className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            {log.steps && <div>Stappen: {log.steps}</div>}
                                            {log.calorie_intake && <div>Cal in: {log.calorie_intake}</div>}
                                            {log.calorie_burn && <div>Cal uit: {log.calorie_burn}</div>}
                                            {log.weight && <div>Gewicht: {log.weight} kg</div>}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                    {userDetails.dailyLogs.length === 0 && (
                                      <p className="text-sm text-muted-foreground">Geen logs gevonden</p>
                                    )}
                                  </div>
                                </TabsContent>

                                <TabsContent value="workouts" className="space-y-2">
                                  <h4 className="font-semibold text-sm">Workouts ({userDetails.workouts.length})</h4>
                                  <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {userDetails.workouts.map((workout) => (
                                      <Card key={workout.id}>
                                        <CardContent className="p-4">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium">{workout.title || 'Workout'}</span>
                                            <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            <div>{format(new Date(workout.date), 'dd/MM/yyyy')}</div>
                                            {workout.start_time && workout.end_time && (
                                              <div>
                                                {format(new Date(workout.start_time), 'HH:mm')} - {format(new Date(workout.end_time), 'HH:mm')}
                                              </div>
                                            )}
                                            {workout.notes && <div className="mt-1">{workout.notes}</div>}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                    {userDetails.workouts.length === 0 && (
                                      <p className="text-sm text-muted-foreground">Geen workouts gevonden</p>
                                    )}
                                  </div>
                                </TabsContent>

                                <TabsContent value="sleep" className="space-y-2">
                                  <h4 className="font-semibold text-sm">Slaap Logs ({userDetails.sleepLogs.length})</h4>
                                  <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {userDetails.sleepLogs.map((sleep) => (
                                      <Card key={sleep.id}>
                                        <CardContent className="p-4">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium">{format(new Date(sleep.date), 'dd/MM/yyyy')}</span>
                                            <Moon className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            {sleep.duration_minutes && <div>Duur: {Math.floor(sleep.duration_minutes / 60)}u {sleep.duration_minutes % 60}m</div>}
                                            {sleep.efficiency && <div>Efficiency: {sleep.efficiency}%</div>}
                                            {sleep.score && <div>Score: {sleep.score}</div>}
                                            {sleep.deep_minutes && <div>Diep: {sleep.deep_minutes}m</div>}
                                            {sleep.rem_minutes && <div>REM: {sleep.rem_minutes}m</div>}
                                            {sleep.light_minutes && <div>Licht: {sleep.light_minutes}m</div>}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                    {userDetails.sleepLogs.length === 0 && (
                                      <p className="text-sm text-muted-foreground">Geen slaap logs gevonden</p>
                                    )}
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </div>
                          </SheetContent>
                        </Sheet>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {u.full_name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUser(u.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Measurements Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.profiles?.full_name}</TableCell>
                    <TableCell>{format(new Date(m.measurement_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{m.weight ? `${m.weight} kg` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Measurement</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this measurement? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMeasurement(m.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
