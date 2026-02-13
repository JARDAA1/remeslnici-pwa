"use client";

/**
 * Client-side app shell.
 *
 * Wraps the entire app with:
 * 1. AuthProvider (session state)
 * 2. Nav (navigation bar, hidden on /login)
 * 3. AuthGuard for protected pages (everything except /login)
 *
 * Mobile-first container: 375px baseline, expands at >=768px.
 */

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

const PUBLIC_PATHS = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="app-shell">
        <Nav />
        <main style={{ padding: 16 }}>
          <ConditionalGuard>{children}</ConditionalGuard>
        </main>
      </div>
    </AuthProvider>
  );
}

function ConditionalGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return <AuthGuard>{children}</AuthGuard>;
}
