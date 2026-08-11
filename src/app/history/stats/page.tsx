"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { HelpTooltip } from "@/components/feedback/HelpTooltip";
import { TrendLineChart } from "@/components/feedback/TrendLineChart";
import { STREET_LABEL_JA } from "@/domain/scenario/labels";
import { Street } from "@/domain/scenario/scenarioState";
import { computeLeakStats } from "@/engine/history/leakStats";
import { computeWeeklyMatchRate } from "@/engine/history/leakTrend";
import { computePracticeStreak, summarizePreflopAttempts } from "@/engine/history/preflopStats";
import { useAuthStore } from "@/state/authStore";
import { useHistoryStore } from "@/state/historyStore";
import { usePreflopStatsStore } from "@/state/preflopStatsStore";

/** >=70% reads as solid, 50-69% as borderline, <50% as a leak worth attention - the same
 *  emerald/amber/rose status vocabulary this app already uses for GTO verdicts (see
 *  AdvisorResultPanel.tsx's VERDICT_COLOR) and pass/fail feedback (ResultPanel.tsx), applied here
 *  to a match-rate value instead of a discrete verdict. */
function matchRateColor(rate: number): string {
  if (rate >= 0.7) return "bg-emerald-500";
  if (rate >= 0.5) return "bg-amber-500";
  return "bg-rose-500";
}

/** One labeled row + percentage bar, shared by both sections below - the numeric rate is always
 *  shown as text alongside the bar, so the color (which varies by value, not by category) is
 *  never the only way to read a row. An optional practiceHref renders a "練習する" link that
 *  jumps straight to /train pre-filtered to this exact weak spot - see /train/page.tsx's
 *  ?mode=/?street=/?position= handling and PostflopTrainPanelProps. */
function MatchRateRow({
  label,
  total,
  matches,
  practiceHref,
}: {
  label: string;
  total: number;
  matches: number;
  practiceHref?: string;
}) {
  const rate = matches / total;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">
            {(rate * 100).toFixed(0)}% ({matches}/{total})
          </span>
          {practiceHref && (
            <Link
              href={practiceHref}
              className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
            >
              練習する
            </Link>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-full ${matchRateColor(rate)}`} style={{ width: `${rate * 100}%` }} />
      </div>
    </div>
  );
}

/** Builds the /train deep-link for a weak street row - preflop switches the trainer to preflop
 *  mode (that trainer has no per-street concept beyond "is preflop"); flop/turn/river route to
 *  the postflop trainer with that street forced. */
function streetPracticeHref(street: Street): string {
  return street === "preflop" ? "/train?mode=preflop" : `/train?mode=postflop&street=${street}`;
}

export default function HistoryStatsPage() {
  const { session, init } = useAuthStore();
  const { statsRecords, statsLoading, statsError, fetchStatsRecords } = useHistoryStore();
  const { attempts, loading: preflopLoading, error: preflopError, fetchAttempts } = usePreflopStatsStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session) {
      void fetchStatsRecords();
      void fetchAttempts();
    }
  }, [session, fetchStatsRecords, fetchAttempts]);

  const leakStats = statsRecords ? computeLeakStats(statsRecords) : null;
  const weeklyTrend = statsRecords ? computeWeeklyMatchRate(statsRecords) : null;
  const preflopSummary = attempts ? summarizePreflopAttempts(attempts) : null;
  const streak = attempts ? computePracticeStreak(attempts) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">傾向分析</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          保存した分析結果とプリフロップ練習の成績から、あなたの傾向を振り返れます。
        </p>
      </header>

      <AuthPanel />

      {session && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">分析履歴の傾向(リークファインダー)</h2>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              分析モードで保存したハンドのうち、ヒーロー自身のアクションを含むものを対象に、実際の選択が推奨(頻度最大のアクション)と一致した割合を集計しています。
            </p>
            {statsLoading && <p className="text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>}
            {statsError && <p className="text-xs text-rose-600 dark:text-rose-400">{statsError}</p>}
            {leakStats && leakStats.totalDecisions === 0 && !statsLoading && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                まだ十分なデータがありません。分析モードでヒーロー自身のアクションを含めて保存すると、ここに集計されます。
              </p>
            )}
            {leakStats && leakStats.totalDecisions > 0 && (
              <>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  全体の一致率: {((leakStats.totalMatches / leakStats.totalDecisions) * 100).toFixed(0)}%（
                  {leakStats.totalMatches}/{leakStats.totalDecisions}件）
                </p>
                {weeklyTrend && weeklyTrend.length >= 2 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 self-start text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      週ごとの推移
                      <HelpTooltip text="1週間(月曜始まり)ごとの一致率です。サンプルが3件未満の週は表示されません。点をタップすると件数の内訳が見られます。" />
                    </div>
                    <TrendLineChart points={weeklyTrend} />
                  </div>
                )}
                {leakStats.byStreet.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ストリート別</div>
                    {leakStats.byStreet.map((s) => (
                      <MatchRateRow
                        key={s.street}
                        label={STREET_LABEL_JA[s.street]}
                        total={s.total}
                        matches={s.matches}
                        practiceHref={streetPracticeHref(s.street)}
                      />
                    ))}
                  </div>
                )}
                {leakStats.byPosition.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ポジション別</div>
                    {leakStats.byPosition.map((p) => (
                      <MatchRateRow
                        key={p.position}
                        label={p.position}
                        total={p.total}
                        matches={p.matches}
                        practiceHref={`/train?mode=postflop&position=${p.position}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">プリフロップ練習の成績</h2>
            {preflopLoading && <p className="text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>}
            {preflopError && <p className="text-xs text-rose-600 dark:text-rose-400">{preflopError}</p>}
            {preflopSummary && preflopSummary.totalAttempts === 0 && !preflopLoading && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                まだ記録がありません。練習モードでクイズに答えると自動的に記録されます。
              </p>
            )}
            {preflopSummary && preflopSummary.totalAttempts > 0 && (
              <>
                {streak && (streak.todayCount > 0 || streak.currentStreakDays > 0) && (
                  <div className="flex items-center justify-center gap-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <span>今日 {streak.todayCount}問</span>
                    {streak.currentStreakDays > 0 && <span>🔥 連続{streak.currentStreakDays}日</span>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">全期間</div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {((preflopSummary.totalCorrect / preflopSummary.totalAttempts) * 100).toFixed(0)}%
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {preflopSummary.totalCorrect}/{preflopSummary.totalAttempts}問
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">直近{preflopSummary.recentAttempts}問</div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {preflopSummary.recentAttempts > 0
                        ? ((preflopSummary.recentCorrect / preflopSummary.recentAttempts) * 100).toFixed(0)
                        : "-"}
                      %
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {preflopSummary.recentCorrect}/{preflopSummary.recentAttempts}問
                    </div>
                  </div>
                </div>
                {preflopSummary.byPosition.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ポジション別正答率</div>
                    {preflopSummary.byPosition.map((p) => (
                      <MatchRateRow
                        key={p.position}
                        label={p.position}
                        total={p.total}
                        matches={p.correct}
                        practiceHref={`/train?mode=preflop&position=${p.position}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
