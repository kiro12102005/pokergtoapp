import { ActionType, Street } from "./scenarioState";

export const ACTION_LABEL_JA: Record<ActionType, string> = {
  fold: "フォールド",
  check: "チェック",
  call: "コール",
  raise: "ベット/レイズ",
  shove: "オールイン",
};

export const STREET_LABEL_JA: Record<Street, string> = {
  preflop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
};
