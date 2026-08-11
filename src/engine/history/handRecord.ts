import { Card } from "@/domain/cards/card";
import { computeCurrentPot, truncateActionsToStreet } from "@/domain/scenario/potCalculator";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { GameFormat } from "@/domain/table/gameFormat";
import { AnalyzeResultDisplay, PlayerStack } from "@/engine/advisor/types";
import { VillainRangeConfig } from "@/engine/equity/villainRangeConfig";

/** The subset of the analyze page's draft state needed to snapshot a hand - kept independent of
 *  analyzeStore.ts's own (larger, UI-action-bearing) state interface so this module stays a pure,
 *  state-layer-agnostic function the way the rest of src/engine does. */
export interface HandRecordDraft {
  street: Street;
  heroPosition: Position;
  effectiveStackBB: number;
  startingPotBB: number;
  board: (Card | null)[];
  heroCards: [Card | null, Card | null];
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  otherPlayers: PlayerStack[];
  extraContext: string;
  villainRanges: Partial<Record<Position, VillainRangeConfig>>;
}

/** What actually gets saved to hand history - the same information buildExternalPrompt() reads,
 *  frozen at save time so a saved record keeps describing the hand as it was even if the user
 *  keeps editing the draft afterward. */
export interface HandRecordSnapshot {
  /** Which format this hand was analyzed under - see domain/table/gameFormat.ts. Records saved
   *  before ring-cash support shipped won't have this field on read-back; display code should
   *  fall back to "tournament" (this app's only format at the time those records were saved). */
  format: GameFormat;
  street: Street;
  heroPosition: Position;
  effectiveStackBB: number;
  startingPotBB: number;
  /** Pot at `street`, precomputed so display code doesn't need potCalculator.ts again. */
  potBB: number;
  board: Card[];
  heroCards: [Card, Card];
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  otherPlayers: PlayerStack[];
  extraContext?: string;
  villainRanges: Partial<Record<Position, VillainRangeConfig>>;
}

/**
 * Builds a saveable snapshot from the analyze page's current draft, applying the same
 * "streets up to and including the current one" truncation as submit()/buildCurrentPrompt() (see
 * truncateActionsToStreet) so a saved record matches what was actually analyzed. Returns null
 * when hero's hand isn't fully picked yet - same guard analyzeStore.ts's submit() uses, since
 * there's nothing meaningful to save before then. `format` comes from formatStore rather than
 * HandRecordDraft since format is a separate, cross-page store, not analyze-page draft state.
 */
export function buildHandRecordSnapshot(draft: HandRecordDraft, format: GameFormat): HandRecordSnapshot | null {
  const [heroCard0, heroCard1] = draft.heroCards;
  if (heroCard0 === null || heroCard1 === null) return null;

  const board = draft.board.filter((c): c is Card => c !== null);
  const actionsByStreet = truncateActionsToStreet(draft.actionsByStreet, draft.street);

  return {
    format,
    street: draft.street,
    heroPosition: draft.heroPosition,
    effectiveStackBB: draft.effectiveStackBB,
    startingPotBB: draft.startingPotBB,
    potBB: computeCurrentPot(draft.startingPotBB, actionsByStreet, draft.street),
    board,
    heroCards: [heroCard0, heroCard1],
    actionsByStreet,
    otherPlayers: draft.otherPlayers,
    extraContext: draft.extraContext.trim() || undefined,
    villainRanges: draft.villainRanges,
  };
}

/** A saved hand history record, in application (camelCase) shape. */
export interface HandRecord {
  id: string;
  createdAt: string;
  memo: string | null;
  snapshot: HandRecordSnapshot;
  results: AnalyzeResultDisplay[];
  externalPrompt: string;
  /** Whether this record is readable by anyone via /shared/[id] (see
   *  hand_records_select_public in supabase/schema.sql) - default false (private). */
  isPublic: boolean;
}

/** The public.hand_records row shape (see supabase/schema.sql) - snake_case, as Postgres/
 *  Supabase returns it. */
export interface HandRecordRow {
  id: string;
  created_at: string;
  memo: string | null;
  snapshot: HandRecordSnapshot;
  results: AnalyzeResultDisplay[];
  external_prompt: string;
  is_public: boolean;
}

export function handRecordFromRow(row: HandRecordRow): HandRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    memo: row.memo,
    snapshot: row.snapshot,
    results: row.results,
    externalPrompt: row.external_prompt,
    isPublic: row.is_public,
  };
}
