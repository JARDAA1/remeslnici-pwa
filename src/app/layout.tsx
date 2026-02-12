import type { Metadata } from "next";
import Nav from "@/components/Nav";

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
        <Nav />
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
