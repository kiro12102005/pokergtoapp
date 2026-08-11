import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { NavBar } from "@/components/layout/NavBar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import "./globals.css";

// Runs before hydration (see next/script's beforeInteractive strategy) so the correct light/dark
// class is already on <html> at first paint - avoids a flash of the wrong theme. Reads the same
// zustand-persist localStorage key themeStore.ts writes to, without importing the store itself
// (this has to run standalone, before any app JS). Falls back to the OS preference when the user
// hasn't made an explicit choice ("system", the default).
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('pokergto-theme');var t='system';if(s){var p=JSON.parse(s);t=(p&&p.state&&p.state.theme)||'system';}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poker Chase GTO Trainer",
  description: "クラブマッチ・リングキャッシュ対応のプリフロップGTOトレーナー",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "PokerGTO",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col pb-24 sm:pb-0">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <NavBar />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
