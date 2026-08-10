import { create } from "zustand";
import { RandomSource } from "@/domain/cards/deck";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { generateRandomPostflopScenario, PostflopScenario } from "@/domain/scenario/postflopScenarioGenerator";
import { ActionEvent, ActionType } from "@/domain/scenario/scenarioState";
import { computeGtoAndFacingBet } from "@/engine/advisor/gtoBaseline";
import { getGeminiAdvice } from "@/engine/advisor/geminiAdvisor";
import { AdvisorSituation, AnalyzeResultDisplay } from "@/engine/advisor/types";
import { useApiKeyStore } from "./apiKeyStore";

interface PostflopTrainState {
  scenario: PostflopScenario | null;
  /** Set once hero submits an action - unlike the preflop trainer (an instant exact-table
   *  lookup), this is an async Gemini call, so `loading` covers the gap. There's no "correct
   *  answer" verdict here (see AdvisorResultPanel's framing) - only the same GTO-baseline +
   *  exploit-AI reference view analyze mode shows. */
  result: AnalyzeResultDisplay | null;
  loading: boolean;
  error: string | null;

  newHand: (random?: RandomSource) => void;
  submitUserAction: (action: ActionType, sizeBB?: number) => Promise<void>;
}

export const usePostflopTrainStore = create<PostflopTrainState>((set, get) => ({
  scenario: null,
  result: null,
  loading: false,
  error: null,

  newHand: (random) => {
    set({ scenario: generateRandomPostflopScenario(random), result: null, error: null });
  },

  submitUserAction: async (action, sizeBB) => {
    const { scenario } = get();
    if (!scenario) return;

    const apiKey = useApiKeyStore.getState().geminiApiKey;
    if (!apiKey) {
      set({ error: "Gemini APIキーを設定してください。" });
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
      street: scenario.street,
      heroPosition: scenario.heroPosition,
      effectiveStackBB: scenario.effectiveStackBB,
      potBB: computeCurrentPot(scenario.startingPotBB, scenario.actionsByStreet, scenario.street),
      board: scenario.board,
      heroCards: scenario.heroCards,
      actionsByStreet: scenario.actionsByStreet,
      gtoBaseline: gto,
      facingBet,
    };

    set({ loading: true, error: null });
    try {
      const advice = await getGeminiAdvice(situation, apiKey);
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
