import { ActionHistoryKey } from "@/engine/solver/abstraction";
import { ActionEvent } from "./scenarioState";

/**
 * Derives which solver action-history layer (rfi/vsOpen/vs3bet/vs4bet) a preflop action
 * sequence has reached, purely from the count of prior raises/shoves - independent of how
 * the sequence was produced (random scenario generation or manual construction).
 */
export function actionHistoryKeyFor(actionHistory: ActionEvent[]): ActionHistoryKey {
  const priorRaises = actionHistory.filter(
    (e) => e.action === "raise" || e.action === "shove"
  ).length;

  if (priorRaises === 0) return "rfi";
  if (priorRaises === 1) return "vsOpen";
  if (priorRaises === 2) return "vs3bet";
  return "vs4bet";
}
