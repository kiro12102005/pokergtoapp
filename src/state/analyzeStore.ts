import { create } from "zustand";
import { Card } from "@/domain/cards/card";
import { canonicalHandOf } from "@/domain/cards/handNotation";
import { actionHistoryKeyFor } from "@/domain/scenario/actionHistoryKey";
import { boardSizeForStreet, validateCustomSituation } from "@/domain/scenario/customSituation";
import { findHeroDecisionPoints } from "@/domain/scenario/decisionPoints";
import { computeCurrentPot, truncateActionsToStreet } from "@/domain/scenario/potCalculator";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { defaultRangeHands, defaultRangePercent, Playstyle } from "@/engine/equity/handStrength";
import { DEFAULT_VILLAIN_RANGE_CONFIG, VillainRangeConfig, VillainRangeMode } from "@/engine/equity/villainRangeConfig";
import { computeGtoAndFacingBet } from "@/engine/advisor/gtoBaseline";
import { getGeminiAdvice } from "@/engine/advisor/geminiAdvisor";
import { buildExternalPrompt } from "@/engine/advisor/promptBuilder";
import { AdvisorSituation, AnalyzeResultDisplay, GtoResult, PlayerStack } from "@/engine/advisor/types";
import { hasPreflopSituation, lookupPreflopStrategy } from "@/engine/solver/solverLookup";
import { Position } from "@/domain/table/seats";
import { useApiKeyStore } from "./apiKeyStore";

export type { VillainRangeConfig, VillainRangeMode };
export type { AnalyzeResultDisplay, GtoResult };

interface AnalyzeStoreState {
  street: Street;
  heroPosition: Position;
  effectiveStackBB: number;
  /** Dead money before any voluntary action - blinds + ante, entered once. The pot at any
   *  decision point is derived from this plus the action history (see potCalculator.ts). */
  startingPotBB: number;
  board: (Card | null)[];
  heroCards: [Card | null, Card | null];
  /** The whole hand's action history, keyed by street - persists across street switches so
   *  navigating preflop -> flop -> back to preflop doesn't lose what was already entered. */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  /** Other players still in the hand/tournament, for ICM context - see AdvisorSituation. */
  otherPlayers: PlayerStack[];
  extraContext: string;
  /** Per-opponent-position range configuration for the GTO baseline calc - lets the user
   *  describe e.g. "BTN plays LAG" separately from "SB plays tight" instead of one shared
   *  assumption for whichever opponent hero happens to be facing. Positions with no entry fall
   *  back to DEFAULT_VILLAIN_RANGE_CONFIG ("auto", i.e. stage-aware default). */
  villainRanges: Partial<Record<Position, VillainRangeConfig>>;
  /** Which position's config is currently shown/edited in the range editor UI. */
  selectedRangePosition: Position | null;

  loading: boolean;
  error: string | null;
  results: AnalyzeResultDisplay[];

  setStreet: (street: Street) => void;
  setHeroPosition: (position: Position) => void;
  setEffectiveStackBB: (bb: number) => void;
  setStartingPotBB: (bb: number) => void;
  setBoardCard: (index: number, card: Card) => void;
  setHeroCard: (index: 0 | 1, card: Card) => void;
  addActionEvent: (event: ActionEvent) => void;
  removeLastActionEvent: () => void;
  addOtherPlayer: () => void;
  updateOtherPlayer: (index: number, update: Partial<PlayerStack>) => void;
  removeOtherPlayer: (index: number) => void;
  setExtraContext: (text: string) => void;
  setSelectedRangePosition: (position: Position | null) => void;
  setRangeMode: (position: Position, mode: VillainRangeMode) => void;
  setRangePercent: (position: Position, percent: number) => void;
  setRangePlaystyle: (position: Position, playstyle: Playstyle) => void;
  toggleManualRangeHand: (position: Position, hand: string) => void;
  resetManualRangeToDefault: (position: Position) => void;
  clearManualRange: (position: Position) => void;
  reset: () => void;
  submit: () => Promise<void>;
  /** Builds a copy-pasteable prompt (play-relevant facts only, no internal persona/JSON-schema
   *  instructions - see buildExternalPrompt()) describing "what should hero do right now", from
   *  the current draft state as entered so far - so the user can paste it into an external chat
   *  AI (Gemini, Claude, ...) instead of/in addition to using this app's own built-in Gemini
   *  call. Returns null when there isn't enough entered yet (hero's hand not fully picked) to
   *  describe a situation at all. */
  buildCurrentPrompt: () => string | null;
}

const ALL_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

function patchRangeConfig(
  state: AnalyzeStoreState,
  position: Position,
  patch: Partial<VillainRangeConfig>
): Partial<Record<Position, VillainRangeConfig>> {
  const current = state.villainRanges[position] ?? DEFAULT_VILLAIN_RANGE_CONFIG;
  return { ...state.villainRanges, [position]: { ...current, ...patch } };
}

const initialDraft = {
  street: "preflop" as Street,
  heroPosition: "BTN" as Position,
  effectiveStackBB: 100,
  startingPotBB: 1.5,
  board: [] as (Card | null)[],
  heroCards: [null, null] as [Card | null, Card | null],
  actionsByStreet: {} as Partial<Record<Street, ActionEvent[]>>,
  otherPlayers: [] as PlayerStack[],
  extraContext: "",
  villainRanges: {} as Partial<Record<Position, VillainRangeConfig>>,
  selectedRangePosition: null as Position | null,
  loading: false,
  error: null as string | null,
  results: [] as AnalyzeResultDisplay[],
};

export const useAnalyzeStore = create<AnalyzeStoreState>((set, get) => ({
  ...initialDraft,

  setStreet: (street) =>
    set((state) => {
      // Board cards accumulate as the hand progresses (flop cards stay when the turn is
      // dealt) rather than resetting - grow/shrink the array to the new street's size
      // while keeping whatever was already picked.
      const targetSize = boardSizeForStreet(street);
      const board = state.board.slice(0, targetSize);
      while (board.length < targetSize) board.push(null);
      return { street, board, error: null };
    }),

  setHeroPosition: (position) =>
    set((state) => ({
      heroPosition: position,
      // A player row that now collides with hero's new position would otherwise fail
      // validation silently later - drop it rather than block until the user notices.
      otherPlayers: state.otherPlayers.filter((p) => p.position !== position),
      error: null,
    })),

  setEffectiveStackBB: (bb) => set({ effectiveStackBB: Math.max(1, Math.min(200, bb)), error: null }),

  setStartingPotBB: (bb) => set({ startingPotBB: Math.max(0.5, bb), error: null }),

  setBoardCard: (index, card) =>
    set((state) => {
      const board = [...state.board];
      board[index] = card;
      return { board, error: null };
    }),

  setHeroCard: (index, card) =>
    set((state) => {
      const heroCards: [Card | null, Card | null] =
        index === 0 ? [card, state.heroCards[1]] : [state.heroCards[0], card];
      return { heroCards, error: null };
    }),

  addActionEvent: (event) =>
    set((state) => ({
      actionsByStreet: {
        ...state.actionsByStreet,
        [state.street]: [...(state.actionsByStreet[state.street] ?? []), event],
      },
      error: null,
    })),

  removeLastActionEvent: () =>
    set((state) => ({
      actionsByStreet: {
        ...state.actionsByStreet,
        [state.street]: (state.actionsByStreet[state.street] ?? []).slice(0, -1),
      },
      error: null,
    })),

  addOtherPlayer: () =>
    set((state) => {
      const used = new Set([state.heroPosition, ...state.otherPlayers.map((p) => p.position)]);
      const nextPosition = ALL_POSITIONS.find((p) => !used.has(p));
      if (!nextPosition) return state; // all 6 seats already accounted for
      return {
        otherPlayers: [...state.otherPlayers, { position: nextPosition, stackBB: state.effectiveStackBB }],
        error: null,
      };
    }),

  updateOtherPlayer: (index, update) =>
    set((state) => ({
      otherPlayers: state.otherPlayers.map((p, i) => (i === index ? { ...p, ...update } : p)),
      error: null,
    })),

  removeOtherPlayer: (index) =>
    set((state) => ({
      otherPlayers: state.otherPlayers.filter((_, i) => i !== index),
      error: null,
    })),

  setExtraContext: (text) => set({ extraContext: text }),

  setSelectedRangePosition: (position) => set({ selectedRangePosition: position }),

  setRangeMode: (position, mode) =>
    set((state) => ({ villainRanges: patchRangeConfig(state, position, { mode }), error: null })),

  setRangePercent: (position, percent) =>
    set((state) => ({
      villainRanges: patchRangeConfig(state, position, { percent: Math.max(1, Math.min(100, percent)) }),
      error: null,
    })),

  setRangePlaystyle: (position, playstyle) =>
    set((state) => ({ villainRanges: patchRangeConfig(state, position, { playstyle }), error: null })),

  toggleManualRangeHand: (position, hand) =>
    set((state) => {
      const current = state.villainRanges[position] ?? DEFAULT_VILLAIN_RANGE_CONFIG;
      const manualHands = current.manualHands.includes(hand)
        ? current.manualHands.filter((h) => h !== hand)
        : [...current.manualHands, hand];
      return { villainRanges: patchRangeConfig(state, position, { manualHands }), error: null };
    }),

  resetManualRangeToDefault: (position) =>
    set((state) => {
      const villainStack = state.otherPlayers.find((p) => p.position === position)?.stackBB;
      const effectiveStackForRange = villainStack
        ? Math.min(state.effectiveStackBB, villainStack)
        : state.effectiveStackBB;
      const playersRemaining = state.otherPlayers.length > 0 ? state.otherPlayers.length + 1 : undefined;
      const percent = defaultRangePercent(effectiveStackForRange, playersRemaining);
      return {
        villainRanges: patchRangeConfig(state, position, { manualHands: defaultRangeHands(percent) }),
        error: null,
      };
    }),

  clearManualRange: (position) =>
    set((state) => ({ villainRanges: patchRangeConfig(state, position, { manualHands: [] }), error: null })),

  reset: () => set({ ...initialDraft }),

  buildCurrentPrompt: () => {
    const state = get();
    const board = state.board.filter((c): c is Card => c !== null);
    const heroCards = state.heroCards;
    if (heroCards[0] === null || heroCards[1] === null) return null;
    const [heroCard0, heroCard1] = [heroCards[0], heroCards[1]];

    const fullActionsByStreet = truncateActionsToStreet(state.actionsByStreet, state.street);
    const otherPlayers = state.otherPlayers.length > 0 ? state.otherPlayers : undefined;
    const extraContext = state.extraContext.trim() || undefined;

    const { gto, facingBet } = computeGtoAndFacingBet({
      startingPotBB: state.startingPotBB,
      heroPosition: state.heroPosition,
      effectiveStackBB: state.effectiveStackBB,
      otherPlayers: state.otherPlayers,
      villainRanges: state.villainRanges,
      street: state.street,
      actionsByStreet: fullActionsByStreet,
      heroCards: [heroCard0, heroCard1],
      board,
    });

    const situation: AdvisorSituation = {
      street: state.street,
      heroPosition: state.heroPosition,
      effectiveStackBB: state.effectiveStackBB,
      potBB: computeCurrentPot(state.startingPotBB, fullActionsByStreet, state.street),
      board,
      heroCards: [heroCard0, heroCard1],
      actionsByStreet: fullActionsByStreet,
      otherPlayers,
      extraContext,
      gtoBaseline: gto,
      facingBet,
    };

    return buildExternalPrompt(situation);
  },

  submit: async () => {
    const state = get();
    const board = state.board.filter((c): c is Card => c !== null);
    const heroCards = state.heroCards;
    if (heroCards[0] === null || heroCards[1] === null) {
      set({ error: "ヒーローのハンドを2枚選択してください。", results: [] });
      return;
    }
    const [heroCard0, heroCard1] = [heroCards[0], heroCards[1]];

    const fullActionsByStreet = truncateActionsToStreet(state.actionsByStreet, state.street);
    const otherPlayers = state.otherPlayers.length > 0 ? state.otherPlayers : undefined;
    const extraContext = state.extraContext.trim() || undefined;

    const validation = validateCustomSituation({
      street: state.street,
      heroPosition: state.heroPosition,
      effectiveStackBB: state.effectiveStackBB,
      potBB: computeCurrentPot(state.startingPotBB, fullActionsByStreet, state.street),
      board,
      heroCards: [heroCard0, heroCard1],
      actionsByStreet: fullActionsByStreet,
      otherPlayers,
      extraContext,
    });
    if (!validation.valid) {
      set({ error: validation.errors.join(" "), results: [] });
      return;
    }

    set({ loading: true, error: null, results: [] });

    // Guarantee loading always resolves, even if something throws synchronously below -
    // a stuck `loading: true` looks exactly like an unresponsive button.
    try {
      // A street's history often includes hero's own already-decided actions (e.g. hero
      // checked, then later called a raise on the same street) - each of those is a separate
      // decision worth its own recommendation, not just one verdict for the whole entered
      // sequence. When hero hasn't acted at all yet, this collapses to the single "what
      // should hero do right now" case.
      const decisionPoints = findHeroDecisionPoints(fullActionsByStreet, state.heroPosition, state.street);
      const apiKey = useApiKeyStore.getState().geminiApiKey;

      const evaluated = await Promise.all(
        decisionPoints.map(async (point): Promise<AnalyzeResultDisplay> => {
          const pointBoard = board.slice(0, boardSizeForStreet(point.street));

          // The GTO baseline (pot odds vs actual equity) only makes sense postflop, facing a
          // bet - it's computed entirely in code (no LLM), reusing Phase 1's own hand
          // evaluator and a fixed default villain range (see handStrength.ts). Whether hero is
          // facing a bet at all (vs. nobody having bet yet this street) is also needed
          // independent of the GTO block, so the LLM prompt knows to say "bet" instead of
          // "raise" for an opening decision (see AdvisorSituation.facingBet).
          const { gto, facingBet } = computeGtoAndFacingBet({
            startingPotBB: state.startingPotBB,
            heroPosition: state.heroPosition,
            effectiveStackBB: state.effectiveStackBB,
            otherPlayers: state.otherPlayers,
            villainRanges: state.villainRanges,
            street: point.street,
            actionsByStreet: point.actionsByStreet,
            heroCards: [heroCard0, heroCard1],
            board: pointBoard,
          });

          const situation: AdvisorSituation = {
            street: point.street,
            heroPosition: state.heroPosition,
            effectiveStackBB: state.effectiveStackBB,
            potBB: computeCurrentPot(state.startingPotBB, point.actionsByStreet, point.street),
            board: pointBoard,
            heroCards: [heroCard0, heroCard1],
            actionsByStreet: point.actionsByStreet,
            otherPlayers,
            extraContext,
            gtoBaseline: gto,
            facingBet,
            actualAction: point.actualAction,
          };

          try {
            const useExactTable = point.street === "preflop" && !situation.otherPlayers;
            if (useExactTable) {
              const actionHistoryKey = actionHistoryKeyFor(situation.actionsByStreet.preflop ?? []);
              if (hasPreflopSituation(situation.heroPosition, situation.effectiveStackBB, actionHistoryKey)) {
                const hand = canonicalHandOf(situation.heroCards[0], situation.heroCards[1]);
                const frequencies = lookupPreflopStrategy(
                  situation.heroPosition,
                  situation.effectiveStackBB,
                  actionHistoryKey,
                  hand
                );
                return { street: point.street, actualAction: point.actualAction, source: "exact", frequencies };
              }
            }

            if (!apiKey) {
              return {
                street: point.street,
                actualAction: point.actualAction,
                source: "error",
                errorMessage: "Gemini APIキーを設定してください。",
                gto,
              };
            }

            const advice = await getGeminiAdvice(situation, apiKey);
            return {
              street: point.street,
              actualAction: point.actualAction,
              source: "llm",
              frequencies: advice.frequencies,
              sizePercentPot: advice.sizePercentPot,
              facingBet,
              rationale: advice.rationale,
              gto,
            };
          } catch (err) {
            return {
              street: point.street,
              actualAction: point.actualAction,
              source: "error",
              errorMessage: err instanceof Error ? err.message : "分析に失敗しました。",
              gto,
            };
          }
        })
      );

      set({ loading: false, results: evaluated });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "分析に失敗しました。",
        results: [],
      });
    }
  },
}));
