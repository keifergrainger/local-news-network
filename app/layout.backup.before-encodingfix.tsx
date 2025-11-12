import "./globals.css";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import SiteNav from "@/app/_components/SiteNav";

const ClientTicker = dynamic(() => import("@/app/_components/TopTicker"), { ssr: false });

export const metadata: Metadata = {
  title: "Local News Network",
  description: "Local news, weather, events, and business directory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="bg-slate-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
          <ClientTicker />
          <SiteNav />
        </header>

        {/* Centered content wrapper for every page */}
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          {children}
        </main>
      </body>
    </html>
  );
}
