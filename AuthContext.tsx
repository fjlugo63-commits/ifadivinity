import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, TABLES, UserRole } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  registerClient: (data: { name: string; email: string; phone?: string; timezone?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('anon');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    // Safety timeout - if auth initialization takes more than 5 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out after 5s, proceeding without auth');
        setLoading(false);
      }
    }, 5000);

    async function initAuth() {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.warn('getSession error:', error.message);
          setLoading(false);
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchUserRole(currentSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Auth initialization failed:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          fetchUserRole(newSession.user.id);
        } else {
          setUserRole('anon');
          setLoading(false);
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.warn('Failed to set up auth state listener:', err);
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUserRole(userId: string) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const { data, error } = await supabase
        .from(TABLES.profiles)
        .select('role')
        .eq('id', userId)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (error || !data) {
        setUserRole('buyer');
      } else {
        setUserRole(data.role as UserRole);
      }
    } catch {
      // Timeout or network error - default to buyer
      setUserRole('buyer');
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, name: string, role: UserRole = 'buyer') {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please connect your Supabase project.') };
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name, role },
        },
      });
      if (!error) {
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (newUser) {
          await supabase.from(TABLES.profiles).upsert({
            id: newUser.id,
            email,
            full_name: name,
            role,
          });
        }
      }
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please connect your Supabase project.') };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signInWithMagicLink(email: string) {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please connect your Supabase project.') };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/client/auth/callback`,
        },
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function registerClient(data: { name: string; email: string; phone?: string; timezone?: string }) {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please connect your Supabase project.') };
    }
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/client/auth/callback`,
          data: { full_name: data.name, role: 'client' },
        },
      });
      if (otpError) return { error: otpError as Error };

      const { error: clientError } = await supabase.from(TABLES.clients).insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        status: 'active',
        awo_id: '00000000-0000-0000-0000-000000000000',
      });
      if (clientError && !clientError.message.includes('duplicate')) {
        return { error: clientError as unknown as Error };
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore signOut errors
    }
    setUserRole('anon');
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, isConfigured: isSupabaseConfigured, signUp, signIn, signInWithMagicLink, registerClient, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}