import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Route guard that requires an active Supabase authentication session.
 * If the user is unauthenticated, redirects them to /sign-in and preserves the return URL.
 */
export function ProtectedRoute({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        if (mounted) {
          setIsAuthenticated(Boolean(data.session));
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
        }
      }
    };

    void checkAuth();

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthenticated(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex items-center gap-2 text-on-surface-variant font-body-sm">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Verifying academic credentials…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        to={`/sign-in?redirectTo=${encodeURIComponent(location.pathname)}`}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Route guard for public guest routes (Sign in, Sign up, Forgot Password).
 * If the user already has an active session, redirects them to /app.
 */
export function GuestRoute({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        if (mounted) {
          setIsAuthenticated(Boolean(data.session));
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
        }
      }
    };

    void checkAuth();

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthenticated(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate replace to="/app" />;
  }

  return <>{children}</>;
}
