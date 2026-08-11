"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CHANGELOG } from "@/data/changelog";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";
import { useChangelogStore } from "@/state/changelogStore";
import { BellIcon, ClockIcon, HelpIcon, HomeIcon, SearchIcon, TargetIcon } from "./NavIcons";

const LINKS = [
  { href: "/", label: "ホーム", icon: HomeIcon },
  { href: "/train", label: "練習", icon: TargetIcon },
  { href: "/analyze", label: "分析", icon: SearchIcon },
  { href: "/history", label: "履歴", icon: ClockIcon },
  { href: "/help", label: "ヘルプ", icon: HelpIcon },
  { href: "/updates", label: "お知らせ", icon: BellIcon },
];

const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date;

/** Mounted once in the root layout - the one place this app initializes the Supabase auth
 *  listener (see authStore.ts's init(), which is a no-op after the first call), so session state
 *  is available to every page (e.g. analyze/page.tsx's "save to history" gating) without each
 *  page remembering to wire it up itself.
 *
 * Renders as a top pill bar on sm+ screens (unchanged from before) and as a fixed bottom tab bar
 * with icons below sm - a phone-first "check it after you play" app benefits from a
 * thumb-reachable bottom bar more than a top one. See layout.tsx for the matching bottom padding
 * on <body> so page content doesn't sit under the fixed bar. */
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
    <>
      <nav
        aria-label="メインナビゲーション"
        className="hidden items-center justify-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 text-xs sm:flex dark:border-zinc-800 dark:bg-zinc-950"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-full px-3 py-1 font-medium transition-colors ${
              pathname === link.href
                ? "bg-emerald-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {link.label}
            {link.href === "/updates" && hasUnreadUpdates && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            )}
          </Link>
        ))}
        {isSupabaseConfigured && (
          <span className="ml-2 max-w-[160px] truncate text-zinc-400 dark:text-zinc-500">
            {session ? session.user.email : "未ログイン"}
          </span>
        )}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="モバイルナビゲーション"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {link.label}
              {link.href === "/updates" && hasUnreadUpdates && (
                <span className="absolute top-1 right-[calc(50%-16px)] h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
