"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CHANGELOG } from "@/data/changelog";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";
import { useChangelogStore } from "@/state/changelogStore";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/train", label: "練習" },
  { href: "/analyze", label: "分析" },
  { href: "/history", label: "履歴" },
];

const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date;

/** Mounted once in the root layout - the one place this app initializes the Supabase auth
 *  listener (see authStore.ts's init(), which is a no-op after the first call), so session state
 *  is available to every page (e.g. analyze/page.tsx's "save to history" gating) without each
 *  page remembering to wire it up itself. */
export function NavBar() {
  const pathname = usePathname();
  const { session, init } = useAuthStore();
  const lastSeenDate = useChangelogStore((s) => s.lastSeenDate);
  // ISO (YYYY-MM-DD) dates compare correctly as plain strings.
  const hasUnreadUpdates = Boolean(LATEST_CHANGELOG_DATE) && (!lastSeenDate || lastSeenDate < LATEST_CHANGELOG_DATE);

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
      <Link
        href="/updates"
        className={`relative rounded-full px-3 py-1 font-medium transition-colors ${
          pathname === "/updates"
            ? "bg-emerald-600 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        お知らせ
        {hasUnreadUpdates && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
        )}
      </Link>
      {isSupabaseConfigured && (
        <span className="ml-2 max-w-[40vw] truncate text-zinc-400 dark:text-zinc-500 sm:max-w-[160px]">
          {session ? session.user.email : "未ログイン"}
        </span>
      )}
    </nav>
  );
}
