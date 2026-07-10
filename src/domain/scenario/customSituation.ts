import { Card, cardsEqual } from "@/domain/cards/card";
import { Street } from "@/domain/scenario/scenarioState";
import { AdvisorSituation } from "@/engine/advisor/types";

const BOARD_SIZE_FOR_STREET: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

export function boardSizeForStreet(street: Street): number {
  return BOARD_SIZE_FOR_STREET[street];
}

/** All cards already in use in this situation - board plus hero's hand. */
export function usedCards(situation: Pick<AdvisorSituation, "board" | "heroCards">): Card[] {
  return [...situation.board, ...situation.heroCards.filter(Boolean)];
}

export interface CustomSituationValidationResult {
  valid: boolean;
  errors: string[];
}

/** Checks a user-built AdvisorSituation is complete and internally consistent before submitting for advice. */
export function validateCustomSituation(situation: AdvisorSituation): CustomSituationValidationResult {
  const errors: string[] = [];

  const expectedBoardSize = boardSizeForStreet(situation.street);
  if (situation.board.length !== expectedBoardSize) {
    errors.push(`${situation.street}のボードは${expectedBoardSize}枚である必要があります(現在${situation.board.length}枚)。`);
  }

  if (situation.heroCards.some((c) => c === null || c === undefined)) {
    errors.push("ヒーローのハンドを2枚選択してください。");
  }

  const allCards = [...situation.board, ...situation.heroCards];
  for (let i = 0; i < allCards.length; i++) {
    for (let j = i + 1; j < allCards.length; j++) {
      if (cardsEqual(allCards[i], allCards[j])) {
        errors.push(`同じカードが重複しています: ${allCards[i].rank}${allCards[i].suit}`);
      }
    }
  }

  if (situation.effectiveStackBB <= 0) {
    errors.push("有効スタックは1BB以上にしてください。");
  }
  if (situation.potBB <= 0) {
    errors.push("スターティングポット(ブラインド+アンティ)を1BB以上にしてください。");
  }

  if (situation.otherPlayers) {
    const positions = [situation.heroPosition, ...situation.otherPlayers.map((p) => p.position)];
    if (new Set(positions).size !== positions.length) {
      errors.push("他のプレイヤーのポジションが重複しています。");
    }
    if (situation.otherPlayers.some((p) => p.stackBB <= 0)) {
      errors.push("他のプレイヤーのスタックは1BB以上にしてください。");
    }
    if (positions.length > 6) {
      errors.push("テーブルの人数は最大6人です。");
    }
  }

  return { valid: errors.length === 0, errors };
}
