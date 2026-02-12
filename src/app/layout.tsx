import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Řemeslníci",
  description: "Track work time, kilometers, and expenses per job",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
