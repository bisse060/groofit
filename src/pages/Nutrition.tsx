import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Trash2, Loader2, UtensilsCrossed, Flame, Beef, Wheat, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface FoodResult {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description: string;
}

interface FoodLog {
  id: string;
  food_name: string;
  brand: string | null;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity: number;
  serving_description: string | null;
}

interface Serving {
  serving_description: string;
  calories: string;
  protein: string;
  carbohydrate: string;
  fat: string;
  fiber: string;
}

const mealTypes = [
  { value: 'breakfast', label: 'Ontbijt', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Avondeten', emoji: '🌙' },
  { value: 'snack', label: 'Snack', emoji: '🍎' },
];

export default function Nutrition() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('snack');

  // Food detail state
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [servings, setServings] = useState<Serving[]>([]);
  const [selectedServing, setSelectedServing] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (user) fetchLogs();
  }, [user, authLoading, date]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('food_logs')
      .select('id, food_name, brand, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, quantity, serving_description')
      .eq('user_id', user!.id)
      .eq('log_date', date)
      .order('created_at', { ascending: true });

    if (!error && data) setFoodLogs(data);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fatsecret-search', {
        body: { query: searchQuery.trim() },
      });
      if (error) throw error;

      const foods = data?.foods?.food;
      if (Array.isArray(foods)) {
        setSearchResults(foods);
      } else if (foods) {
        setSearchResults([foods]);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Zoekfout opgetreden');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFood = async (food: FoodResult) => {
    setSelectedFood(food);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase.functions.invoke('fatsecret-search', {
        body: { food_id: food.food_id },
      });
      if (error) throw error;

      const srv = data?.food?.servings?.serving;
      if (Array.isArray(srv)) {
        setServings(srv);
      } else if (srv) {
        setServings([srv]);
      } else {
        setServings([]);
      }
      setSelectedServing(0);
      setQuantity(1);
    } catch (err) {
      console.error('Food detail error:', err);
      toast.error('Kon voedingsinfo niet laden');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddFood = async () => {
    if (!selectedFood || servings.length === 0) return;
    const srv = servings[selectedServing];
    
    const { error } = await supabase.from('food_logs').insert({
      user_id: user!.id,
      log_date: date,
      meal_type: selectedMealType,
      food_name: selectedFood.food_name,
      brand: selectedFood.brand_name || null,
      fatsecret_food_id: selectedFood.food_id,
      serving_description: srv.serving_description,
      calories: (parseFloat(srv.calories) || 0) * quantity,
      protein_g: (parseFloat(srv.protein) || 0) * quantity,
      carbs_g: (parseFloat(srv.carbohydrate) || 0) * quantity,
      fat_g: (parseFloat(srv.fat) || 0) * quantity,
      fiber_g: (parseFloat(srv.fiber) || 0) * quantity,
      quantity,
    });

    if (error) {
      toast.error('Kon voedsel niet toevoegen');
    } else {
      toast.success(`${selectedFood.food_name} toegevoegd`);
      setSelectedFood(null);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchLogs();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (!error) {
      setFoodLogs(prev => prev.filter(l => l.id !== id));
      toast.success('Verwijderd');
    }
  };

  // Totals
  const totals = foodLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein_g || 0),
      carbs: acc.carbs + (l.carbs_g || 0),
      fat: acc.fat + (l.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const groupedLogs = mealTypes.map(mt => ({
    ...mt,
    items: foodLogs.filter(l => l.meal_type === mt.value),
  }));

  if (authLoading) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Voeding</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM', { locale: nl })}
            </p>
          </div>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-auto"
          />
        </div>

        {/* Daily totals */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Flame className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold">{Math.round(totals.calories)}</p>
                <p className="text-[10px] text-muted-foreground">kcal</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Beef className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold">{Math.round(totals.protein)}g</p>
                <p className="text-[10px] text-muted-foreground">Eiwit</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Wheat className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold">{Math.round(totals.carbs)}g</p>
                <p className="text-[10px] text-muted-foreground">Koolh.</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Droplets className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold">{Math.round(totals.fat)}g</p>
                <p className="text-[10px] text-muted-foreground">Vet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meal groups */}
        {groupedLogs.map(group => (
          <div key={group.value} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium flex items-center gap-1.5">
                <span>{group.emoji}</span> {group.label}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setSelectedMealType(group.value);
                  setSearchOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Toevoegen
              </Button>
            </div>

            {group.items.length === 0 ? (
              <Card>
                <CardContent className="p-3 text-center text-xs text-muted-foreground">
                  Nog niets toegevoegd
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.food_name}</p>
                        {item.brand && (
                          <p className="text-[10px] text-muted-foreground">{item.brand}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.serving_description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{Math.round(item.calories)} kcal</p>
                        <p className="text-[10px] text-muted-foreground">
                          E{Math.round(item.protein_g)} K{Math.round(item.carbs_g)} V{Math.round(item.fat_g)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Search Dialog */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Voedsel zoeken
              </DialogTitle>
            </DialogHeader>

            {!selectedFood ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Zoek een product..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    autoFocus
                  />
                  <Button onClick={handleSearch} disabled={searching} size="icon">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                    {searchResults.map(food => (
                      <button
                        key={food.food_id}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                        onClick={() => handleSelectFood(food)}
                      >
                        <p className="text-sm font-medium">{food.food_name}</p>
                        {food.brand_name && (
                          <p className="text-[10px] text-muted-foreground">{food.brand_name}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {food.food_description}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchResults.length === 0 && searchQuery && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Geen resultaten gevonden
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedFood(null)} className="text-xs">
                  ← Terug naar resultaten
                </Button>

                <div>
                  <h3 className="font-medium">{selectedFood.food_name}</h3>
                  {selectedFood.brand_name && (
                    <p className="text-xs text-muted-foreground">{selectedFood.brand_name}</p>
                  )}
                </div>

                {loadingDetail ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : servings.length > 0 ? (
                  <>
                    {servings.length > 1 && (
                      <Select
                        value={String(selectedServing)}
                        onValueChange={v => setSelectedServing(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {servings.map((s, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {s.serving_description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-sm">Aantal:</span>
                      <Input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={quantity}
                        onChange={e => setQuantity(Math.max(0.25, parseFloat(e.target.value) || 1))}
                        className="w-20"
                      />
                    </div>

                    {/* Nutrition preview */}
                    <Card>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <p className="font-bold text-base">{Math.round((parseFloat(servings[selectedServing].calories) || 0) * quantity)}</p>
                            <p className="text-muted-foreground">kcal</p>
                          </div>
                          <div>
                            <p className="font-bold text-base">{Math.round((parseFloat(servings[selectedServing].protein) || 0) * quantity)}g</p>
                            <p className="text-muted-foreground">Eiwit</p>
                          </div>
                          <div>
                            <p className="font-bold text-base">{Math.round((parseFloat(servings[selectedServing].carbohydrate) || 0) * quantity)}g</p>
                            <p className="text-muted-foreground">Koolh.</p>
                          </div>
                          <div>
                            <p className="font-bold text-base">{Math.round((parseFloat(servings[selectedServing].fat) || 0) * quantity)}g</p>
                            <p className="text-muted-foreground">Vet</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Button className="w-full" onClick={handleAddFood}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Toevoegen aan {mealTypes.find(m => m.value === selectedMealType)?.label}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">Geen portie-informatie beschikbaar</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
