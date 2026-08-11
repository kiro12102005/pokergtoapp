"use client";

import { useEffect } from "react";
import { computePracticeStreak } from "@/engine/history/preflopStats";
import { useAuthStore } from "@/state/authStore";
import { usePreflopStatsStore } from "@/state/preflopStatsStore";

/**
 * "今日X問・連続N日" badge, fed by the same logged preflop-attempt history /history/stats
 * summarizes (see preflopStatsStore.ts's fetchAttempts / preflopStats.ts's computePracticeStreak).
 * Login-gated like the rest of the history feature - practice itself works fully without an
 * account, so this renders nothing (not an error/prompt) when signed out, rather than nagging a
 * user who has deliberately chosen not to log in.
 */
export function PracticeStreakBadge() {
  const { session, init } = useAuthStore();
  const { attempts, fetchAttempts } = usePreflopStatsStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session) void fetchAttempts();
  }, [session, fetchAttempts]);

  if (!session || !attempts) return null;

  const { todayCount, currentStreakDays } = computePracticeStreak(attempts);
  if (todayCount === 0 && currentStreakDays === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <span>今日 {todayCount}問</span>
      {currentStreakDays > 0 && <span>🔥 連続{currentStreakDays}日</span>}
    </div>
  );
}
