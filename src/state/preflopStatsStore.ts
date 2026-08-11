import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabase/client";
import { friendlySupabaseError } from "@/lib/supabase/errorMessage";
import { Position } from "@/domain/table/seats";
import { ActionHistoryKey } from "@/engine/solver/abstraction";
import { PreflopAttemptRecord } from "@/engine/history/preflopStats";
import { useAuthStore } from "./authStore";

const ATTEMPT_COLUMNS = "created_at, position, is_correct";
const FETCH_LIMIT = 500;

export interface PreflopAttemptInput {
  position: Position;
  effectiveStackBB: number;
  actionHistoryKey: ActionHistoryKey;
  hand: string;
  isCorrect: boolean;
}

export type { PreflopAttemptRecord };

interface AttemptRow {
  created_at: string;
  position: Position;
  is_correct: boolean;
}

interface PreflopStatsState {
  attempts: PreflopAttemptRecord[] | null;
  loading: boolean;
  error: string | null;

  /** Fire-and-forget: logs one solved quiz question for the signed-in user. A no-op (not an
   *  error) when Supabase isn't configured or nobody's signed in - preflop training works fully
   *  without an account, this is purely supplementary. */
  logAttempt: (input: PreflopAttemptInput) => Promise<void>;
  /** Fetches up to FETCH_LIMIT attempts (newest first) for the /history/stats dashboard - see
   *  preflopStats.ts's summarizePreflopAttempts(). */
  fetchAttempts: () => Promise<void>;
}

export const usePreflopStatsStore = create<PreflopStatsState>((set, get) => ({
  attempts: null,
  loading: false,
  error: null,

  logAttempt: async (input) => {
    const supabase = getSupabaseClient();
    if (!supabase || !useAuthStore.getState().session) return;

    const { error } = await supabase.from("preflop_attempts").insert({
      position: input.position,
      effective_stack_bb: input.effectiveStackBB,
      action_history_key: input.actionHistoryKey,
      hand: input.hand,
      is_correct: input.isCorrect,
    });
    // Best-effort - a failed background log shouldn't interrupt the quiz flow, but still worth
    // surfacing quietly (see TrainPage) rather than failing silently forever.
    if (error) {
      set({ error: friendlySupabaseError(error) });
      return;
    }
    // Re-fetch so PracticeStreakBadge.tsx's today-count/streak reflects this attempt immediately
    // instead of only after the next full page load - cheap enough (a few hundred rows at most)
    // not to bother gating on whether anything is actually showing the badge right now.
    void get().fetchAttempts();
  },

  fetchAttempts: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabaseが設定されていません。" });
      return;
    }
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("preflop_attempts")
      .select(ATTEMPT_COLUMNS)
      .order("created_at", { ascending: false })
      .range(0, FETCH_LIMIT - 1);

    if (error) {
      set({ loading: false, error: friendlySupabaseError(error) });
      return;
    }
    const attempts = (data as AttemptRow[]).map((row) => ({
      createdAt: row.created_at,
      position: row.position,
      isCorrect: row.is_correct,
    }));
    set({ loading: false, attempts });
  },
}));
