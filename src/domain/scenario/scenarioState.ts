import { Card } from "@/domain/cards/card";
import { Position } from "@/domain/table/seats";

export type Street = "preflop" | "flop" | "turn" | "river";

export type ActionType = "fold" | "check" | "call" | "raise" | "shove";

export interface ActionEvent {
  position: Position;
  action: ActionType;
  /** Raise-to size in BB, when action is "raise" or "shove". */
  sizeBB?: number;
}

/** A strategy as a probability mix over actions, e.g. { raise: 0.78, call: 0.15, fold: 0.07 }. */
export type StrategyMix = Partial<Record<ActionType, number>>;

export interface ScenarioState {
  id: string;
  street: Street;

  blindLevel: number;
  sb: number;
  bb: number;
  ante: number;

  heroPosition: Position;
  stacks: Record<Position, number>;
  effectiveStackBB: number;

  heroCards: [Card, Card] | null;
  /** Empty in Phase 1 (preflop only); populated in Phase 2 once postflop streets are added. */
  board: Card[];

  potBB: number;
  actionHistory: ActionEvent[];
  toAct: Position;

  solverRecommendation?: StrategyMix;
  userAction?: ActionEvent;
  isCorrect?: boolean;
}
