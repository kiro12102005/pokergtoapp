import { Card } from "@/domain/cards/card";
import { RandomSource } from "@/domain/cards/deck";
import { ALL_HANDS, comboCount, enumerateCombos } from "@/domain/cards/handNotation";
import { PREFLOP_ACTION_ORDER, Position, positionsAfter, positionsBefore } from "@/domain/table/seats";
import { BLIND_LEVELS } from "@/data/blindLevels";
import {
  ANTE_TO_BB_RATIO,
  OPEN_RAISE_SIZE_BB,
  STACK_DEPTH_BUCKETS_BB,
  THREE_BET_SIZE_MULTIPLIER_OOP,
  isShoveOnlyDepth,
} from "@/engine/solver/abstraction";
import { ActionEvent, ScenarioState } from "./scenarioState";

const OPEN_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB"];

function pickRandom<T>(items: T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)];
}

function pickWeightedHand(random: RandomSource): string {
  const totalWeight = ALL_HANDS.reduce((sum, h) => sum + comboCount(h), 0);
  let target = random() * totalWeight;
  for (const hand of ALL_HANDS) {
    target -= comboCount(hand);
    if (target <= 0) return hand;
  }
  return ALL_HANDS[ALL_HANDS.length - 1];
}

function dealHeroCards(random: RandomSource): { hand: string; cards: [Card, Card] } {
  const hand = pickWeightedHand(random);
  const combos = enumerateCombos(hand);
  const combo = pickRandom(combos, random);
  return { hand, cards: combo };
}

function foldEvents(positions: Position[]): ActionEvent[] {
  return positions.map((position) => ({ position, action: "fold" as const }));
}

export interface GeneratedScenario {
  scenario: ScenarioState;
  hand: string;
}

/**
 * Randomly generates a preflop practice scenario, constrained to the situations the Phase 1
 * solver actually covers (rfi / vsOpen / vs3bet / vs4bet, using the same single-representative-
 * opponent reduction as the solver - see pushFoldSolver.ts / cfrSolver.ts).
 */
export function generateRandomScenario(random: RandomSource = Math.random): GeneratedScenario {
  const blindLevel = pickRandom(BLIND_LEVELS, random);
  const targetStackBB = STACK_DEPTH_BUCKETS_BB[Math.floor(random() * STACK_DEPTH_BUCKETS_BB.length)] * (0.8 + random() * 0.4);
  const shoveOnly = isShoveOnlyDepth(targetStackBB);

  const scenarioTypeRoll = random();
  const openerPosition = pickRandom(OPEN_POSITIONS, random);
  const nextPosition = positionsAfter(openerPosition)[0];

  let heroPosition: Position;
  let toAct: Position;
  let actionHistory: ActionEvent[];
  let potBB: number;

  const deadMoneyPotBB = 0.5 + 1 + 6 * ANTE_TO_BB_RATIO;
  const threeBetSizeBB = OPEN_RAISE_SIZE_BB * THREE_BET_SIZE_MULTIPLIER_OOP;

  const rfiThreshold = shoveOnly ? 0.55 : 0.5;
  const vsOpenThreshold = shoveOnly ? 1.0 : 0.8;
  const vs3betThreshold = 0.92;

  if (scenarioTypeRoll < rfiThreshold) {
    // rfi: action folded to openerPosition, hero decides.
    heroPosition = openerPosition;
    toAct = heroPosition;
    actionHistory = foldEvents(positionsBefore(heroPosition));
    potBB = deadMoneyPotBB;
  } else if (scenarioTypeRoll < vsOpenThreshold) {
    // vsOpen: openerPosition opened (or shoved, if shove-only depth), hero is the next seat.
    heroPosition = nextPosition;
    toAct = heroPosition;
    const openAction: ActionEvent = shoveOnly
      ? { position: openerPosition, action: "shove", sizeBB: targetStackBB }
      : { position: openerPosition, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB };
    actionHistory = [...foldEvents(positionsBefore(openerPosition)), openAction];
    potBB = deadMoneyPotBB + (shoveOnly ? targetStackBB : OPEN_RAISE_SIZE_BB);
  } else if (scenarioTypeRoll < vs3betThreshold && !shoveOnly) {
    // vs3bet: hero opened, nextPosition 3bet, hero decides fold/call/shove.
    heroPosition = openerPosition;
    toAct = heroPosition;
    actionHistory = [
      ...foldEvents(positionsBefore(openerPosition)),
      { position: openerPosition, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB },
      { position: nextPosition, action: "raise", sizeBB: threeBetSizeBB },
    ];
    potBB = deadMoneyPotBB + OPEN_RAISE_SIZE_BB + threeBetSizeBB;
  } else if (!shoveOnly) {
    // vs4bet: openerPosition opened, hero (nextPosition) 3bet, openerPosition shoved (4bet),
    // hero decides call/fold facing the shove.
    heroPosition = nextPosition;
    toAct = heroPosition;
    actionHistory = [
      ...foldEvents(positionsBefore(openerPosition)),
      { position: openerPosition, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB },
      { position: nextPosition, action: "raise", sizeBB: threeBetSizeBB },
      { position: openerPosition, action: "shove", sizeBB: targetStackBB },
    ];
    potBB = deadMoneyPotBB + threeBetSizeBB + targetStackBB;
  } else {
    heroPosition = openerPosition;
    toAct = heroPosition;
    actionHistory = foldEvents(positionsBefore(heroPosition));
    potBB = deadMoneyPotBB;
  }

  const { hand, cards } = dealHeroCards(random);

  const stacks: Record<Position, number> = {} as Record<Position, number>;
  for (const position of PREFLOP_ACTION_ORDER) {
    const stackBB =
      position === heroPosition ? targetStackBB : targetStackBB * (0.5 + random() * 1.5);
    stacks[position] = Math.round(stackBB * blindLevel.bb);
  }

  const scenario: ScenarioState = {
    id: `${Date.now()}-${Math.floor(random() * 1e9)}`,
    street: "preflop",
    blindLevel: blindLevel.level,
    sb: blindLevel.sb,
    bb: blindLevel.bb,
    ante: blindLevel.ante,
    heroPosition,
    stacks,
    effectiveStackBB: targetStackBB,
    heroCards: cards,
    board: [],
    potBB,
    actionHistory,
    toAct,
  };

  return { scenario, hand };
}
