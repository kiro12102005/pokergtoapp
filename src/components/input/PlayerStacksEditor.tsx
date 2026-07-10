"use client";

import { PlayerStack } from "@/engine/advisor/types";
import { Position } from "@/domain/table/seats";

const ALL_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

export interface PlayerStacksEditorProps {
  heroPosition: Position;
  otherPlayers: PlayerStack[];
  onAdd: () => void;
  onUpdate: (index: number, update: Partial<PlayerStack>) => void;
  onRemove: (index: number) => void;
}

/**
 * Lets the user list exactly the players still at the table (not fixed to 6-max - players
 * bust out over a club match) with their stacks, for ICM-aware analysis. Leaving this empty
 * keeps the fast symmetric-stacks exact preflop lookup; adding anyone here always routes
 * through the LLM advisor so the real stack distribution's ICM pressure is considered.
 */
export function PlayerStacksEditor({
  heroPosition,
  otherPlayers,
  onAdd,
  onUpdate,
  onRemove,
}: PlayerStacksEditorProps) {
  const canAddMore = otherPlayers.length + 1 < ALL_POSITIONS.length;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        他のプレイヤーのスタック(ICM考慮・任意)
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        残っている人数分だけ追加してください(バストしたプレイヤーは追加不要)。1人も追加しなければ、通常の(全員同じ深さと仮定した)簡易解を使います。
      </p>

      {otherPlayers.length > 0 && (
        <div className="flex flex-col gap-2">
          {otherPlayers.map((player, i) => {
            const usedByOthers = new Set([
              heroPosition,
              ...otherPlayers.filter((_, j) => j !== i).map((p) => p.position),
            ]);
            const options = ALL_POSITIONS.filter((p) => !usedByOthers.has(p) || p === player.position);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={player.position}
                  onChange={(e) => onUpdate(i, { position: e.target.value as Position })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {options.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={player.stackBB}
                  onChange={(e) => onUpdate(i, { stackBB: Math.max(1, Number(e.target.value)) })}
                  className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">BB</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="ml-auto rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
                >
                  削除
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={!canAddMore}
        className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
      >
        + プレイヤーを追加
      </button>
    </div>
  );
}
