"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/work", label: "Práce" },
  { href: "/jobs", label: "Zakázky" },
  { href: "/entries", label: "Záznamy" },
  { href: "/summary", label: "Přehled" },
  { href: "/settings", label: "Nastavení" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 16, padding: "12px 16px", borderBottom: "1px solid #ccc" }}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ fontWeight: pathname === l.href ? "bold" : "normal" }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
