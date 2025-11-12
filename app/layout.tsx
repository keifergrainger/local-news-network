import "./globals.css";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import SiteNav from "@/app/_components/SiteNav";
import EncodingFix from "@/app/_components/EncodingFix";

const ClientTicker = dynamic(
  () => import("@/app/_components/TopTicker"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Local News Network",
  description: "Local news, weather, events, and business directory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
          {/* Ticker is client-side only */}
          <ClientTicker />
          <SiteNav />
        </header>

        {/* fixes mojibake like â€” â€¢ after hydration */}
        <EncodingFix />

        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
