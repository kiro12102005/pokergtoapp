import { ActionType, StrategyMix } from "@/domain/scenario/scenarioState";

const ACTION_LABEL: Record<ActionType, string> = {
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  raise: "RAISE",
  shove: "ALL IN",
};

const ACTION_BAR_COLOR: Record<ActionType, string> = {
  fold: "bg-zinc-400 dark:bg-zinc-600",
  check: "bg-zinc-400 dark:bg-zinc-600",
  call: "bg-sky-500",
  raise: "bg-amber-500",
  shove: "bg-rose-500",
};

export interface FrequencyBarProps {
  mix: StrategyMix;
  /** Overrides the "raise" key's label - e.g. "BET" for an opening decision (nobody has bet
   *  this street yet) vs the default "RAISE" for responding to an existing wager. Only the
   *  "raise" key's label changes; fold/check/call/shove are unambiguous regardless of context. */
  raiseLabel?: string;
  /** Appended after the "raise" key's percentage, e.g. "pot 66%" - the LLM's suggested sizing
   *  (see AdvisorResult.sizePercentPot). Omitted when no sizing was given. */
  raiseSizeLabel?: string;
}

/** Horizontal stacked bar showing the solver's recommended action frequency mix. */
export function FrequencyBar({ mix, raiseLabel, raiseSizeLabel }: FrequencyBarProps) {
  const entries = (Object.entries(mix) as [ActionType, number][]).filter(([, v]) => v > 0.001);
  entries.sort((a, b) => b[1] - a[1]);
  const labelFor = (action: ActionType) => (action === "raise" ? (raiseLabel ?? ACTION_LABEL.raise) : ACTION_LABEL[action]);

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        {entries.map(([action, value]) => (
          <div
            key={action}
            className={`h-full ${ACTION_BAR_COLOR[action]}`}
            style={{ width: `${value * 100}%` }}
            title={`${labelFor(action)} ${(value * 100).toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
        {entries.map(([action, value]) => (
          <span key={action}>
            {labelFor(action)} {(value * 100).toFixed(0)}%
            {action === "raise" && raiseSizeLabel ? ` (${raiseSizeLabel})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
