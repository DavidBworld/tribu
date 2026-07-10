import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasFamily, setHasFamily] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Vérifier la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkFamily(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkFamily(session.user.id);
      } else {
        setHasFamily(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkFamily = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setHasFamily(!!data);
    } catch (err) {
      console.error('Erreur de vérification de l\'onboarding de famille:', err);
      setHasFamily(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur connecté, rediriger vers login
  if (!user) {
    if (location.pathname === '/login') {
      return <>{children}</>;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si connecté mais sur login, rediriger vers l'application
  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  // Si connecté sur l'onboarding mais a déjà une famille, rediriger vers l'application
  if (location.pathname === '/onboarding' && hasFamily) {
    return <Navigate to="/" replace />;
  }

  // Si connecté sans famille et pas sur onboarding, rediriger vers onboarding
  if (location.pathname !== '/onboarding' && hasFamily === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
