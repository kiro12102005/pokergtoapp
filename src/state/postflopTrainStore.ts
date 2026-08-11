import { create } from "zustand";
import { RandomSource } from "@/domain/cards/deck";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import {
  generateRandomPostflopScenario,
  PostflopPotType,
  PostflopScenario,
  PostflopScenarioOptions,
  PostflopStreet,
} from "@/domain/scenario/postflopScenarioGenerator";
import { ActionEvent, ActionType } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { computeGtoAndFacingBet } from "@/engine/advisor/gtoBaseline";
import { AdvisorSituation, AnalyzeResultDisplay } from "@/engine/advisor/types";
import { currentApiKey, getAdvice, missingApiKeyMessage } from "./advisorDispatch";
import { useFormatStore } from "./formatStore";

interface PostflopTrainState {
  scenario: PostflopScenario | null;
  /** Set once hero submits an action - unlike the preflop trainer (an instant exact-table
   *  lookup), this is an async Gemini call, so `loading` covers the gap. There's no "correct
   *  answer" verdict here (see AdvisorResultPanel's framing) - only the same GTO-baseline +
   *  exploit-AI reference view analyze mode shows. */
  result: AnalyzeResultDisplay | null;
  loading: boolean;
  error: string | null;

  /** Manual scenario filters applied on every newHand() - "random" means no constraint on that
   *  dimension (same vocabulary PositionSelector already uses). Lets the user practice a
   *  specific pot type/street/position on demand (see PostflopTrainPanel.tsx's filter row), and
   *  lets the leak-finder's "practice this weak spot" links (see /history/stats, train/page.tsx)
   *  pre-select one before the very first hand deals. */
  potTypeFilter: PostflopPotType | "random";
  streetFilter: PostflopStreet | "random";
  positionFilter: Position | "random";
  setPotTypeFilter: (v: PostflopPotType | "random") => void;
  setStreetFilter: (v: PostflopStreet | "random") => void;
  setPositionFilter: (v: Position | "random") => void;

  newHand: (random?: RandomSource) => void;
  submitUserAction: (action: ActionType, sizeBB?: number) => Promise<void>;
}

export const usePostflopTrainStore = create<PostflopTrainState>((set, get) => ({
  scenario: null,
  result: null,
  loading: false,
  error: null,

  potTypeFilter: "random",
  streetFilter: "random",
  positionFilter: "random",
  setPotTypeFilter: (v) => set({ potTypeFilter: v }),
  setStreetFilter: (v) => set({ streetFilter: v }),
  setPositionFilter: (v) => set({ positionFilter: v }),

  newHand: (random) => {
    const { potTypeFilter, streetFilter, positionFilter } = get();
    const { format } = useFormatStore.getState();
    const options: PostflopScenarioOptions = { format };
    if (potTypeFilter !== "random") options.potType = potTypeFilter;
    if (streetFilter !== "random") options.targetStreet = streetFilter;
    if (positionFilter !== "random") options.heroPosition = positionFilter;
    set({ scenario: generateRandomPostflopScenario(random, options), result: null, error: null });
  },

  submitUserAction: async (action, sizeBB) => {
    const { scenario } = get();
    if (!scenario) return;

    if (!currentApiKey()) {
      set({ error: missingApiKeyMessage() });
      return;
    }

    const actualAction: ActionEvent = { position: scenario.heroPosition, action, sizeBB };

    const { gto, facingBet } = computeGtoAndFacingBet({
      startingPotBB: scenario.startingPotBB,
      heroPosition: scenario.heroPosition,
      effectiveStackBB: scenario.effectiveStackBB,
      otherPlayers: [],
      villainRanges: {},
      street: scenario.street,
      actionsByStreet: scenario.actionsByStreet,
      heroCards: scenario.heroCards,
      board: scenario.board,
    });

    const situation: AdvisorSituation = {
      format: useFormatStore.getState().format,
      street: scenario.street,
      heroPosition: scenario.heroPosition,
      effectiveStackBB: scenario.effectiveStackBB,
      potBB: computeCurrentPot(scenario.startingPotBB, scenario.actionsByStreet, scenario.street),
      board: scenario.board,
      heroCards: scenario.heroCards,
      actionsByStreet: scenario.actionsByStreet,
      gtoBaseline: gto,
      facingBet,
      actualAction,
    };

    set({ loading: true, error: null });
    try {
      const advice = await getAdvice(situation);
      set({
        loading: false,
        result: {
          street: scenario.street,
          actualAction,
          source: "llm",
          frequencies: advice.frequencies,
          sizePercentPot: advice.sizePercentPot,
          facingBet,
          rationale: advice.rationale,
          provider: advice.provider,
          gto,
        },
      });
    } catch (err) {
      set({
        loading: false,
        result: {
          street: scenario.street,
          actualAction,
          source: "error",
          errorMessage: err instanceof Error ? err.message : "分析に失敗しました。",
          facingBet,
          gto,
        },
      });
    }
  },
}));
