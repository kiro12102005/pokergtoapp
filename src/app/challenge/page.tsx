"use client";

import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";

interface WeeklyChallenge {
  id: string;
  week_label: string;
  title: string;
  situation_summary: string;
  choices: string[];
  correct_choice_index: number;
  explanation: string;
}

interface ChallengeStats {
  total: number;
  correct: number;
}

interface OwnResponse {
  choice_index: number;
  is_correct: boolean;
}

/**
 * A single hand the operator posts once a week (inserted directly via the Supabase SQL editor -
 * see README), so everyone answers the same spot and can compare notes - the "SNS的話題性" angle
 * from the differentiation discussion, distinct from the personal leak-finder in /history/stats.
 * Answering while signed out still reveals the result locally, just without being recorded (see
 * handleChoose) - a taste of the app's value doesn't require an account first.
 */
export default function ChallengePage() {
  const { session, init } = useAuthStore();
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [ownResponse, setOwnResponse] = useState<OwnResponse | null>(null);
  const [localChoice, setLocalChoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from("weekly_challenges")
        .select("id, week_label, title, situation_summary, choices, correct_choice_index, explanation")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError || !data) {
        setError(fetchError ? "読み込みに失敗しました。" : null);
        setLoading(false);
        return;
      }
      setChallenge(data as WeeklyChallenge);

      const { data: statsRow } = await supabase
        .from("weekly_challenge_stats")
        .select("total, correct")
        .eq("challenge_id", data.id)
        .maybeSingle();
      if (!cancelled) setStats((statsRow as ChallengeStats) ?? { total: 0, correct: 0 });
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Separate from the challenge/stats fetch above so it re-runs once useAuthStore's async
  // getSession() resolves, rather than racing it (session is still null on first render even for
  // an already-signed-in user) - see authStore.ts's init().
  useEffect(() => {
    if (!session || !challenge) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("weekly_challenge_responses")
      .select("choice_index, is_correct")
      .eq("challenge_id", challenge.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOwnResponse((data as OwnResponse) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session, challenge]);

  const handleChoose = async (index: number) => {
    if (!challenge) return;
    if (!session) {
      setLocalChoice(index);
      return;
    }
    setSubmitting(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSubmitting(false);
      return;
    }
    const isCorrect = index === challenge.correct_choice_index;
    const { error: insertError } = await supabase
      .from("weekly_challenge_responses")
      .insert({ challenge_id: challenge.id, choice_index: index, is_correct: isCorrect });
    // A unique-violation (23505) just means this user already answered - re-read their original
    // answer instead of treating it as a failure.
    if (insertError && insertError.code !== "23505") {
      setError("回答の送信に失敗しました。");
      setSubmitting(false);
      return;
    }
    const { data: responseRow } = await supabase
      .from("weekly_challenge_responses")
      .select("choice_index, is_correct")
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    setOwnResponse((responseRow as OwnResponse) ?? { choice_index: index, is_correct: isCorrect });
    const { data: statsRow } = await supabase
      .from("weekly_challenge_stats")
      .select("total, correct")
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    setStats((statsRow as ChallengeStats) ?? stats);
    setSubmitting(false);
  };

  const revealedIndex = ownResponse?.choice_index ?? localChoice;
  const revealed = revealedIndex !== null;
  const isCorrect = revealed && revealedIndex === challenge?.correct_choice_index;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">今週のハンド</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          毎週1問、みんなで同じハンドを解いて答え合わせできます。
        </p>
      </header>

      <AuthPanel />

      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Supabaseが設定されていません。
        </div>
      )}

      {isSupabaseConfigured && loading && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">読み込み中...</p>
      )}

      {isSupabaseConfigured && !loading && !challenge && !error && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">現在出題中のハンドはありません。</p>
      )}

      {error && (
        <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      {challenge && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
            <span>{challenge.week_label}</span>
            {stats && stats.total > 0 && (
              <span>
                これまで{stats.total}人が回答 / 正解率{Math.round((stats.correct / stats.total) * 100)}%
              </span>
            )}
          </div>
          <h2 className="font-bold text-zinc-900 dark:text-zinc-50">{challenge.title}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            {challenge.situation_summary}
          </p>

          <div className="flex flex-col gap-2">
            {challenge.choices.map((choice, index) => {
              const isSelected = revealedIndex === index;
              const isTheCorrectOne = revealed && index === challenge.correct_choice_index;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={revealed || submitting}
                  onClick={() => void handleChoose(index)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    isTheCorrectOne
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                      : isSelected
                        ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className={`text-sm font-bold ${isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {isCorrect ? "正解!" : "不正解"}
              </p>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{challenge.explanation}</p>
              {!session && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  ログインすると回答が記録され、正解率の集計にも反映されます。
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
