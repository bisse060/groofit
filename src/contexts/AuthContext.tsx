import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const sessionStartRef = useRef<number | null>(null);

  const recordSession = async (userId: string) => {
    if (sessionStartRef.current === null) return;
    const minutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
    sessionStartRef.current = null;
    if (minutes < 1) return;
    await supabase.rpc('record_session', { p_user_id: userId, p_duration_minutes: minutes });
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          sessionStartRef.current = Date.now();
          setTimeout(() => {
            checkAdminStatus(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        sessionStartRef.current = Date.now();
        checkAdminStatus(session.user.id);
      }
      setLoading(false);
    });

    // Record session on page unload
    const handleUnload = () => {
      const uid = supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user && sessionStartRef.current !== null) {
          const minutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
          if (minutes >= 1) {
            navigator.sendBeacon
              ? navigator.sendBeacon(`/api/noop`) // fallback – real recording via visibility change
              : null;
          }
        }
      });
    };

    const handleVisibilityChange = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session?.user) return;
        if (document.visibilityState === 'hidden') {
          recordSession(data.session.user.id);
        } else {
          sessionStartRef.current = Date.now();
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      navigate('/dashboard');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (!error) {
      navigate('/dashboard');
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      if (user) await recordSession(user.id);
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      navigate('/auth');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
