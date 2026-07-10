import { ActionType } from "@/domain/scenario/scenarioState";
import {
  ActionHistoryKey,
  OPEN_RAISE_SIZE_BB,
  THREE_BET_SIZE_MULTIPLIER_OOP,
} from "@/engine/solver/abstraction";

export interface ActionBarProps {
  availableActions: ActionType[];
  actionHistoryKey: ActionHistoryKey;
  effectiveStackBB: number;
  onAction: (action: ActionType, sizeBB?: number) => void;
  disabled?: boolean;
}

const threeBetSizeBB = OPEN_RAISE_SIZE_BB * THREE_BET_SIZE_MULTIPLIER_OOP;

function labelAndSize(
  action: ActionType,
  actionHistoryKey: ActionHistoryKey,
  effectiveStackBB: number
): { label: string; sizeBB?: number } {
  switch (action) {
    case "fold":
      return { label: "FOLD" };
    case "call":
      return { label: "CALL" };
    case "raise":
      if (actionHistoryKey === "rfi") {
        return { label: `RAISE ${OPEN_RAISE_SIZE_BB}BB`, sizeBB: OPEN_RAISE_SIZE_BB };
      }
      return { label: `3-BET ${threeBetSizeBB}BB`, sizeBB: threeBetSizeBB };
    case "shove":
      return { label: `ALL IN ${Math.round(effectiveStackBB)}BB`, sizeBB: effectiveStackBB };
    case "check":
      return { label: "CHECK" };
  }
}

const ACTION_COLOR: Record<ActionType, string> = {
  fold: "bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100",
  check: "bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100",
  call: "bg-sky-600 hover:bg-sky-700 text-white",
  raise: "bg-amber-600 hover:bg-amber-700 text-white",
  shove: "bg-rose-600 hover:bg-rose-700 text-white",
};

export function ActionBar({
  availableActions,
  actionHistoryKey,
  effectiveStackBB,
  onAction,
  disabled,
}: ActionBarProps) {
  return (
    <div className="flex justify-center gap-3">
      {availableActions.map((action) => {
        const { label, sizeBB } = labelAndSize(action, actionHistoryKey, effectiveStackBB);
        return (
          <button
            key={action}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action, sizeBB)}
            className={`rounded-lg px-5 py-2 text-sm font-bold shadow transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_COLOR[action]}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
