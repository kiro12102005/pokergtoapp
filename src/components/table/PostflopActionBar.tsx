import { ActionType } from "@/domain/scenario/scenarioState";

export interface PostflopActionBarProps {
  /** Whether villain has already bet the flop (fold/call/raise) or not (check/bet) - see
   *  PostflopScenario.facingBet. Drives which button set is shown. */
  facingBet: boolean;
  potBB: number;
  /** Villain's flop bet size, when facingBet - used to size the raise button. */
  betAmountBB?: number;
  effectiveStackBB: number;
  onAction: (action: ActionType, sizeBB?: number) => void;
  disabled?: boolean;
}

const BASE_BTN =
  "rounded-lg px-5 py-2 text-sm font-bold shadow transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const NEUTRAL_STYLE =
  "bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100";
const CALL_STYLE = "bg-sky-600 hover:bg-sky-700 text-white";
const BET_STYLE = "bg-amber-600 hover:bg-amber-700 text-white";

const FLOP_BET_SIZE_PERCENT_POT = [33, 66, 100];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The postflop-training equivalent of ActionBar.tsx - unlike preflop's fixed open/3-bet sizes,
 * postflop sizing is expressed as a small set of round %-pot buttons (bet) or a fixed multiplier
 * of the bet faced (raise), since there's no single "correct" size to hardcode here (the
 * exploit-AI feedback comments on sizing choice itself - see AdvisorResultPanel).
 */
export function PostflopActionBar({
  facingBet,
  potBB,
  betAmountBB,
  effectiveStackBB,
  onAction,
  disabled,
}: PostflopActionBarProps) {
  if (facingBet) {
    const raiseTo = round1(Math.min(effectiveStackBB, (betAmountBB ?? 0) * 2.5));
    return (
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" disabled={disabled} onClick={() => onAction("fold")} className={`${BASE_BTN} ${NEUTRAL_STYLE}`}>
          FOLD
        </button>
        <button type="button" disabled={disabled} onClick={() => onAction("call")} className={`${BASE_BTN} ${CALL_STYLE}`}>
          CALL
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction("raise", raiseTo)}
          className={`${BASE_BTN} ${BET_STYLE}`}
        >
          RAISE {raiseTo}BB
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      <button type="button" disabled={disabled} onClick={() => onAction("check")} className={`${BASE_BTN} ${NEUTRAL_STYLE}`}>
        CHECK
      </button>
      {FLOP_BET_SIZE_PERCENT_POT.map((pct) => {
        const sizeBB = round1(Math.min(effectiveStackBB, potBB * (pct / 100)));
        return (
          <button
            key={pct}
            type="button"
            disabled={disabled}
            onClick={() => onAction("raise", sizeBB)}
            className={`${BASE_BTN} ${BET_STYLE}`}
          >
            BET {pct}% ({sizeBB}BB)
          </button>
        );
      })}
    </div>
  );
}
