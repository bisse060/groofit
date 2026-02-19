import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CACHE_KEY = 'coach_insight_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 uur

function getCache(): { text: string; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCache(text: string) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() }));
}

export default function CoachInsightCard() {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setInsight(cached.text);
      setLoading(false);
    } else {
      fetchInsight();
    }
  }, []);

  const fetchInsight = async (force = false) => {
    if (force) {
      setRefreshing(true);
      setError(false);
    } else {
      setLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError(true);
        return;
      }

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'dashboard-insight' }),
      });

      if (!resp.ok) {
        console.error('Coach insight HTTP error:', resp.status);
        setError(true);
        return;
      }
      const result = await resp.json();
      if (result.insight) {
        setInsight(result.insight);
        setError(false);
        setCache(result.insight);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Coach insight error:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 animate-pulse">
        <div className="w-7 h-7 rounded-full bg-primary/10 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error && !insight) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="flex-1 text-sm text-muted-foreground">AI Coach kon geen inzicht laden.</p>
        <button
          onClick={() => fetchInsight(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          title="Opnieuw proberen"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-0.5">AI Coach</p>
        <p className="text-sm text-foreground leading-snug">{insight}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          onClick={() => fetchInsight(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          title="Vernieuwen"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
        <Link to="/coach" className="text-muted-foreground hover:text-primary transition-colors p-1 rounded">
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
