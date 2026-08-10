"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/train", label: "練習" },
  { href: "/analyze", label: "分析" },
  { href: "/history", label: "履歴" },
];

/** Mounted once in the root layout - the one place this app initializes the Supabase auth
 *  listener (see authStore.ts's init(), which is a no-op after the first call), so session state
 *  is available to every page (e.g. analyze/page.tsx's "save to history" gating) without each
 *  page remembering to wire it up itself. */
export function NavBar() {
  const pathname = usePathname();
  const { session, init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            pathname === link.href
              ? "bg-emerald-600 text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {link.label}
        </Link>
      ))}
      {isSupabaseConfigured && (
        <span className="ml-2 truncate text-zinc-400 dark:text-zinc-500">
          {session ? session.user.email : "未ログイン"}
        </span>
      )}
    </nav>
  );
}
