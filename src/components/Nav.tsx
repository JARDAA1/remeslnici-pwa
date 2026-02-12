"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/AuthProvider";

const links = [
  { href: "/work", label: "Práce" },
  { href: "/jobs", label: "Zakázky" },
  { href: "/entries", label: "Záznamy" },
  { href: "/summary", label: "Přehled" },
  { href: "/settings", label: "Nastavení" },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Don't show nav on login page or when not authenticated
  if (!user || pathname === "/login") {
    return null;
  }

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderBottom: "1px solid #ccc",
        flexWrap: "wrap",
      }}
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ fontWeight: pathname === l.href ? "bold" : "normal" }}
        >
          {l.label}
        </Link>
      ))}

      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span style={{ color: "#666" }}>{user.email}</span>
        <button
          onClick={logout}
          style={{
            background: "none",
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Odhlásit
        </button>
      </span>
    </nav>
  );
}
