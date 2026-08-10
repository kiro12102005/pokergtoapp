import { ActionEvent } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";

export interface SeatProps {
  position: Position;
  stackBB: number;
  isHero: boolean;
  isToAct: boolean;
  lastAction?: ActionEvent;
  style?: React.CSSProperties;
}

const ACTION_LABEL: Record<ActionEvent["action"], string> = {
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  raise: "RAISE",
  shove: "ALL IN",
};

export function Seat({ position, stackBB, isHero, isToAct, lastAction, style }: SeatProps) {
  const folded = lastAction?.action === "fold";
  return (
    <div
      style={style}
      className={`absolute flex w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg border px-1 py-0.5 text-center transition-opacity sm:w-20 sm:px-2 sm:py-1 ${
        isHero
          ? "border-amber-500 bg-amber-50 dark:bg-amber-950"
          : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      } ${folded ? "opacity-40" : "opacity-100"} ${
        isToAct ? "ring-2 ring-amber-400" : ""
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-700 sm:text-xs dark:text-zinc-200">
        {position === "BTN" && (
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-zinc-800 text-[8px] text-white sm:h-4 sm:w-4 sm:text-[10px] dark:bg-zinc-200 dark:text-zinc-900">
            D
          </span>
        )}
        {position}
      </div>
      <div className="text-[10px] tabular-nums text-zinc-500 sm:text-xs dark:text-zinc-400">
        {Math.round(stackBB)}BB
      </div>
      {lastAction && (
        <div className="text-[8px] font-semibold text-amber-700 sm:text-[10px] dark:text-amber-400">
          {ACTION_LABEL[lastAction.action]}
          {lastAction.sizeBB ? ` ${lastAction.sizeBB.toFixed(1)}BB` : ""}
        </div>
      )}
    </div>
  );
}
