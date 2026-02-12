"use client";

/**
 * Auth guard wrapper.
 *
 * Renders children only when the user is authenticated.
 * While checking session → shows loading indicator.
 * If not authenticated → redirects to /login.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/AuthProvider";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <p style={{ padding: 32, textAlign: "center" }}>Načítám…</p>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
