"use client";

/**
 * Authentication context provider.
 *
 * Wraps the app and provides:
 * - current user session (or null)
 * - loading state (true while checking session on mount)
 * - login / register / logout functions
 *
 * Uses Supabase email/password auth.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./client";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Current user or null if not authenticated */
  user: User | null;
  /** Full session (includes access token) or null */
  session: Session | null;
  /** True while initial session check is in progress */
  loading: boolean;
  /** Sign in with email + password */
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Create new account with email + password */
  register: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign out */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    // 1. Get current session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // 2. Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await getSupabase().auth.signUp({
        email,
        password,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const logout = useCallback(async () => {
    await getSupabase().auth.signOut();
    setSession(null);
  }, []);

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
