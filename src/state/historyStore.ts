import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabase/client";
import { friendlySupabaseError } from "@/lib/supabase/errorMessage";
import { buildHandRecordSnapshot, handRecordFromRow, HandRecord, HandRecordRow } from "@/engine/history/handRecord";
import { useAnalyzeStore } from "./analyzeStore";
import { useAuthStore } from "./authStore";

const HAND_RECORD_COLUMNS = "id, created_at, memo, snapshot, results, external_prompt, is_public";
const PAGE_SIZE = 20;
// A personal/club-mate-scale app is never going to have thousands of saved hands per user, so a
// single generous-but-bounded fetch is simpler than paginating the stats dashboard too - see
// fetchStatsRecords().
const STATS_FETCH_LIMIT = 500;

interface HistoryState {
  records: HandRecord[];
  loading: boolean;
  /** True while fetching an additional page via loadMore() - kept separate from `loading` so the
   *  "もっと読み込む" button can show its own spinner without re-rendering the whole list as
   *  loading. */
  loadingMore: boolean;
  /** Whether the last page fetched was full-sized, i.e. there's likely more to load. */
  hasMore: boolean;
  error: string | null;

  /** Records for the /history/stats leak-finder dashboard - deliberately a separate, unpaginated
   *  fetch/state from `records` (the paginated /history list), so the two pages don't fight over
   *  what "loaded" means. */
  statsRecords: HandRecord[] | null;
  statsLoading: boolean;
  statsError: string | null;

  /** Fetches the first page, replacing whatever was loaded before (e.g. on initial page load, or
   *  after signing in). */
  fetchRecords: () => Promise<void>;
  /** Fetches the next page and appends it - a no-op while already loading or when hasMore is
   *  false. */
  loadMore: () => Promise<void>;
  /** Fetches up to STATS_FETCH_LIMIT records (newest first) for the leak-finder dashboard - see
   *  leakStats.ts's computeLeakStats(). */
  fetchStatsRecords: () => Promise<void>;
  /** Snapshots the analyze page's current draft + its latest results + the external-AI prompt
   *  for them, and saves it as a new history record for the signed-in user. Requires hero's hand
   *  to be fully picked (see buildHandRecordSnapshot) and an active session. */
  saveCurrentAnalysis: (memo?: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  /** Flips a record's public/private flag (see hand_records_select_public in
   *  supabase/schema.sql) - a public record becomes readable by anyone via /shared/[id], no
   *  login required. Updates both `records` and `statsRecords` in place if present, so whichever
   *  page the user toggled from reflects it immediately. */
  toggleShare: (id: string, isPublic: boolean) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  statsRecords: null,
  statsLoading: false,
  statsError: null,

  fetchRecords: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabaseが設定されていません。" });
      return;
    }
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("hand_records")
      .select(HAND_RECORD_COLUMNS)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (error) {
      set({ loading: false, error: friendlySupabaseError(error) });
      return;
    }
    const records = (data as HandRecordRow[]).map(handRecordFromRow);
    set({ loading: false, records, hasMore: records.length === PAGE_SIZE });
  },

  loadMore: async () => {
    const { loading, loadingMore, hasMore, records } = get();
    if (loading || loadingMore || !hasMore) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    set({ loadingMore: true, error: null });
    const { data, error } = await supabase
      .from("hand_records")
      .select(HAND_RECORD_COLUMNS)
      .order("created_at", { ascending: false })
      .range(records.length, records.length + PAGE_SIZE - 1);

    if (error) {
      set({ loadingMore: false, error: friendlySupabaseError(error) });
      return;
    }
    const nextPage = (data as HandRecordRow[]).map(handRecordFromRow);
    set({
      loadingMore: false,
      records: [...records, ...nextPage],
      hasMore: nextPage.length === PAGE_SIZE,
    });
  },

  fetchStatsRecords: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ statsError: "Supabaseが設定されていません。" });
      return;
    }
    set({ statsLoading: true, statsError: null });
    const { data, error } = await supabase
      .from("hand_records")
      .select(HAND_RECORD_COLUMNS)
      .order("created_at", { ascending: false })
      .range(0, STATS_FETCH_LIMIT - 1);

    if (error) {
      set({ statsLoading: false, statsError: friendlySupabaseError(error) });
      return;
    }
    set({ statsLoading: false, statsRecords: (data as HandRecordRow[]).map(handRecordFromRow) });
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
    // Reads the inserted row straight back (rather than a full fetchRecords() refetch) so saving
    // doesn't reset any pagination the user has already loaded further down via loadMore().
    const { data, error } = await supabase
      .from("hand_records")
      .insert({
        memo: memo?.trim() || null,
        snapshot,
        results: analyze.results,
        external_prompt: externalPrompt,
      })
      .select(HAND_RECORD_COLUMNS)
      .single();

    if (error) {
      set({ loading: false, error: friendlySupabaseError(error) });
      return;
    }
    set({ loading: false, records: [handRecordFromRow(data as HandRecordRow), ...get().records] });
  },

  deleteRecord: async (id) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.from("hand_records").delete().eq("id", id);
    if (error) {
      set({ error: friendlySupabaseError(error) });
      return;
    }
    // Patch statsRecords too, same as toggleShare - the /history page's search/filter view
    // renders from statsRecords when a filter is active, so leaving it unpatched here would
    // show a just-deleted record until the next full refetch.
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      statsRecords: state.statsRecords ? state.statsRecords.filter((r) => r.id !== id) : state.statsRecords,
    }));
  },

  toggleShare: async (id, isPublic) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.from("hand_records").update({ is_public: isPublic }).eq("id", id);
    if (error) {
      set({ error: friendlySupabaseError(error) });
      return;
    }
    const patch = (r: HandRecord) => (r.id === id ? { ...r, isPublic } : r);
    set((state) => ({
      records: state.records.map(patch),
      statsRecords: state.statsRecords ? state.statsRecords.map(patch) : state.statsRecords,
    }));
  },
}));
