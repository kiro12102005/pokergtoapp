import { Card } from "@/domain/cards/card";
import { computePotOdds } from "@/domain/scenario/potOdds";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { computeEquityVsRange } from "@/engine/equity/rangeEquity";
import {
  DEFAULT_VILLAIN_RANGE_CONFIG,
  resolveVillainRange,
  VillainRangeConfig,
} from "@/engine/equity/villainRangeConfig";
import { GtoResult, PlayerStack } from "./types";

const GTO_MARGIN = 0.03;

export interface GtoBaselineInput {
  startingPotBB: number;
  heroPosition: Position;
  effectiveStackBB: number;
  otherPlayers: PlayerStack[];
  villainRanges: Partial<Record<Position, VillainRangeConfig>>;
  street: Street;
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  heroCards: [Card, Card];
  /** The board as of `street` (already sized/sliced for it). */
  board: Card[];
}

/**
 * The deterministic (non-LLM) pot-odds-vs-equity baseline for a single decision point, plus
 * whether hero is facing a bet at all. Shared by analyzeStore.ts (submit()/buildCurrentPrompt(),
 * one call per hero decision point) and postflopTrainStore.ts (one call per generated practice
 * hand), so both stay in exact sync on this math instead of maintaining two copies of it.
 */
export function computeGtoAndFacingBet(input: GtoBaselineInput): { gto?: GtoResult; facingBet?: boolean } {
  if (input.street === "preflop") return {};

  const potOdds = computePotOdds(input.startingPotBB, input.actionsByStreet, input.street, input.heroPosition);
  const facingBet = potOdds !== null;
  if (!potOdds) return { facingBet };

  // The range that matters is specifically whoever set the bet hero is facing (see
  // potOdds.ts's facingPosition), not one generic "the villain" assumption - each position can
  // have its own configured range (see villainRangeConfig.ts).
  const facingPosition = potOdds.facingPosition;
  const config = facingPosition
    ? (input.villainRanges[facingPosition] ?? DEFAULT_VILLAIN_RANGE_CONFIG)
    : DEFAULT_VILLAIN_RANGE_CONFIG;
  // "auto" mode uses the effective stack between hero and that specific opponent when their
  // stack is known (standard effective-stack definition), falling back to hero's own stack
  // when it isn't (e.g. no ICM stacks entered).
  const villainStack = facingPosition
    ? input.otherPlayers.find((p) => p.position === facingPosition)?.stackBB
    : undefined;
  const effectiveStackForRange = villainStack
    ? Math.min(input.effectiveStackBB, villainStack)
    : input.effectiveStackBB;
  const playersRemaining = input.otherPlayers.length > 0 ? input.otherPlayers.length + 1 : undefined;
  const { hands: rangeHands, description: rangeDescription } = resolveVillainRange(
    config,
    facingPosition ?? "相手",
    effectiveStackForRange,
    playersRemaining
  );

  const heroEquity = computeEquityVsRange(input.heroCards, input.board, rangeHands);
  const verdict: GtoResult["verdict"] =
    heroEquity > potOdds.requiredEquity + GTO_MARGIN
      ? "call"
      : heroEquity < potOdds.requiredEquity - GTO_MARGIN
        ? "fold"
        : "marginal";

  return {
    facingBet,
    gto: {
      callAmount: potOdds.callAmount,
      requiredEquity: potOdds.requiredEquity,
      heroEquity,
      rangeDescription,
      verdict,
    },
  };
}
