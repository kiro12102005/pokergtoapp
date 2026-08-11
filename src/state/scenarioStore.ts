import { create } from "zustand";
import { Card } from "@/domain/cards/card";
import { RandomSource } from "@/domain/cards/deck";
import { canonicalHandOf } from "@/domain/cards/handNotation";
import { actionHistoryKeyFor } from "@/domain/scenario/actionHistoryKey";
import { ActionEvent, ActionType, ScenarioState, StrategyMix } from "@/domain/scenario/scenarioState";
import { generateRandomScenario } from "@/domain/scenario/scenarioGenerator";
import { Position } from "@/domain/table/seats";
import { ActionHistoryKey, isShoveOnlyDepth } from "@/engine/solver/abstraction";
import { lookupPreflopStrategy, SolverLookupError } from "@/engine/solver/solverLookup";
import { usePreflopStatsStore } from "./preflopStatsStore";
import { useFormatStore } from "./formatStore";

interface ScenarioStoreState {
  scenario: ScenarioState | null;
  heroHand: string | null;
  actionHistoryKey: ActionHistoryKey | null;
  shoveOnly: boolean;
  lookupError: string | null;
  handsPlayed: number;
  handsCorrect: number;

  newHand: (options?: {
    preferredPosition?: Position | "random";
    /** Force a specific stack-depth bucket (see STACK_DEPTH_BUCKETS_BB) instead of a fully
     *  random one - see PreflopTrainPanel's depth filter in train/page.tsx. */
    preferredStackBB?: number | "random";
    random?: RandomSource;
  }) => Promise<void>;
  submitUserAction: (action: ActionType, sizeBB?: number) => void;
  setHeroCard: (index: 0 | 1, card: Card) => Promise<void>;
  setEffectiveStackBB: (stackBB: number) => Promise<void>;
}

function argmaxAction(mix: StrategyMix): ActionType {
  let best: ActionType = "fold";
  let bestValue = -Infinity;
  for (const [action, value] of Object.entries(mix) as [ActionType, number][]) {
    if (value > bestValue) {
      bestValue = value;
      best = action;
    }
  }
  return best;
}

async function applyLookup(
  scenario: ScenarioState,
  hand: string,
  actionHistoryKey: ActionHistoryKey
): Promise<{ scenario: ScenarioState; lookupError: string | null }> {
  try {
    const { format, cashRake } = useFormatStore.getState();
    const recommendation = await lookupPreflopStrategy(
      scenario.toAct,
      scenario.effectiveStackBB,
      actionHistoryKey,
      hand,
      format,
      cashRake
    );
    return {
      scenario: { ...scenario, solverRecommendation: recommendation, userAction: undefined, isCorrect: undefined },
      lookupError: null,
    };
  } catch (err) {
    const message = err instanceof SolverLookupError ? err.message : String(err);
    return {
      scenario: { ...scenario, solverRecommendation: undefined, userAction: undefined, isCorrect: undefined },
      lookupError: message,
    };
  }
}

export const useScenarioStore = create<ScenarioStoreState>((set, get) => ({
  scenario: null,
  heroHand: null,
  actionHistoryKey: null,
  shoveOnly: false,
  lookupError: null,
  handsPlayed: 0,
  handsCorrect: 0,

  newHand: async (options) => {
    const { preferredPosition, preferredStackBB, random } = options ?? {};
    const { format } = useFormatStore.getState();
    const genOptions = {
      format,
      ...(preferredStackBB && preferredStackBB !== "random" ? { targetStackBB: preferredStackBB } : undefined),
    };
    let generated = generateRandomScenario(random, genOptions);
    if (preferredPosition && preferredPosition !== "random") {
      for (let attempt = 0; attempt < 40; attempt++) {
        if (generated.scenario.heroPosition === preferredPosition) break;
        generated = generateRandomScenario(random, genOptions);
      }
    }
    const { scenario, hand } = generated;
    const actionHistoryKey = actionHistoryKeyFor(scenario.actionHistory);
    const shoveOnly = isShoveOnlyDepth(scenario.effectiveStackBB);
    const { scenario: withRecommendation, lookupError } = await applyLookup(scenario, hand, actionHistoryKey);

    set({
      scenario: withRecommendation,
      heroHand: hand,
      actionHistoryKey,
      shoveOnly,
      lookupError,
    });
  },

  submitUserAction: (action, sizeBB) => {
    const { scenario, heroHand, actionHistoryKey } = get();
    if (!scenario || !scenario.solverRecommendation) return;

    const userAction: ActionEvent = { position: scenario.toAct, action, sizeBB };
    const recommended = argmaxAction(scenario.solverRecommendation);
    const isCorrect = recommended === action;

    set((state) => ({
      scenario: { ...scenario, userAction, isCorrect },
      handsPlayed: state.handsPlayed + 1,
      handsCorrect: state.handsCorrect + (isCorrect ? 1 : 0),
    }));

    if (heroHand && actionHistoryKey) {
      void usePreflopStatsStore.getState().logAttempt({
        position: scenario.toAct,
        effectiveStackBB: scenario.effectiveStackBB,
        actionHistoryKey,
        hand: heroHand,
        isCorrect,
      });
    }
  },

  setHeroCard: async (index, card) => {
    const { scenario, actionHistoryKey } = get();
    if (!scenario || !scenario.heroCards || !actionHistoryKey) return;
    const otherCard = scenario.heroCards[index === 0 ? 1 : 0];
    if (otherCard.rank === card.rank && otherCard.suit === card.suit) return;

    const newCards: [Card, Card] =
      index === 0 ? [card, scenario.heroCards[1]] : [scenario.heroCards[0], card];
    const hand = canonicalHandOf(newCards[0], newCards[1]);
    const updatedScenario: ScenarioState = { ...scenario, heroCards: newCards };
    const { scenario: withRecommendation, lookupError } = await applyLookup(
      updatedScenario,
      hand,
      actionHistoryKey
    );
    set({ scenario: withRecommendation, heroHand: hand, lookupError });
  },

  setEffectiveStackBB: async (stackBB) => {
    const { scenario, heroHand, actionHistoryKey } = get();
    if (!scenario || !heroHand || !actionHistoryKey) return;
    const clamped = Math.max(1, Math.min(200, stackBB));
    const updatedScenario: ScenarioState = { ...scenario, effectiveStackBB: clamped };
    const shoveOnly = isShoveOnlyDepth(clamped);
    const { scenario: withRecommendation, lookupError } = await applyLookup(
      updatedScenario,
      heroHand,
      actionHistoryKey
    );
    set({ scenario: withRecommendation, shoveOnly, lookupError });
  },
}));
