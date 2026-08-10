import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabase/client";
import { buildHandRecordSnapshot, handRecordFromRow, HandRecord, HandRecordRow } from "@/engine/history/handRecord";
import { useAnalyzeStore } from "./analyzeStore";
import { useAuthStore } from "./authStore";

interface HistoryState {
  records: HandRecord[];
  loading: boolean;
  error: string | null;

  fetchRecords: () => Promise<void>;
  /** Snapshots the analyze page's current draft + its latest results + the external-AI prompt
   *  for them, and saves it as a new history record for the signed-in user. Requires hero's hand
   *  to be fully picked (see buildHandRecordSnapshot) and an active session. */
  saveCurrentAnalysis: (memo?: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabaseが設定されていません。" });
      return;
    }
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("hand_records")
      .select("id, created_at, memo, snapshot, results, external_prompt")
      .order("created_at", { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, records: (data as HandRecordRow[]).map(handRecordFromRow) });
  },

  saveCurrentAnalysis: async (memo) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabaseが設定されていません。" });
      return;
    }
    if (!useAuthStore.getState().session) {
      set({ error: "ログインしてください。" });
      return;
    }

    const analyze = useAnalyzeStore.getState();
    const snapshot = buildHandRecordSnapshot(analyze);
    // The same "hero's hand must be fully picked" precondition buildHandRecordSnapshot enforces
    // also makes buildCurrentPrompt() return non-null, so this check covers both.
    const externalPrompt = analyze.buildCurrentPrompt();
    if (!snapshot || !externalPrompt) {
      set({ error: "ヒーローのハンドを2枚選択してください。" });
      return;
    }

    set({ loading: true, error: null });
    const { error } = await supabase.from("hand_records").insert({
      memo: memo?.trim() || null,
      snapshot,
      results: analyze.results,
      external_prompt: externalPrompt,
    });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false });
    await get().fetchRecords();
  },

  deleteRecord: async (id) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.from("hand_records").delete().eq("id", id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ records: get().records.filter((r) => r.id !== id) });
  },
}));
