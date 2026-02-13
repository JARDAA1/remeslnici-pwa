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
    <nav style={{ borderBottom: "1px solid #eee", background: "#fafafa" }}>
      {/* Mobile: vertical stack */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          gap: 4,
        }}
      >
        {/* Nav links */}
        <div
          className="nav-links"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: "block",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: pathname === l.href ? 700 : 400,
                color: pathname === l.href ? "#111" : "#555",
                background: pathname === l.href ? "#e8e8e8" : "transparent",
                textDecoration: "none",
                minHeight: 48,
                lineHeight: "24px",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* User info + logout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            marginTop: 4,
            borderTop: "1px solid #eee",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "#666",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
            }}
          >
            {user.email}
          </span>
          <button
            onClick={logout}
            data-compact=""
            style={{
              width: "auto",
              minHeight: 36,
              padding: "6px 12px",
              fontSize: 13,
              flex: "none",
            }}
          >
            Odhlásit
          </button>
        </div>
      </div>
    </nav>
  );
}
