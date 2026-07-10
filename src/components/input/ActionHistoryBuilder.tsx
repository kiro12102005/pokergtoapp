"use client";

import { useState } from "react";
import { ACTION_LABEL_JA } from "@/domain/scenario/labels";
import { ActionEvent, ActionType } from "@/domain/scenario/scenarioState";
import { PREFLOP_ACTION_ORDER, Position } from "@/domain/table/seats";

export interface ActionHistoryBuilderProps {
  actionHistory: ActionEvent[];
  onAdd: (event: ActionEvent) => void;
  onRemoveLast: () => void;
}

const ACTION_OPTIONS: ActionType[] = ["fold", "check", "call", "raise", "shove"];

const NEEDS_SIZE: Record<ActionType, boolean> = {
  fold: false,
  check: false,
  call: false,
  raise: true,
  shove: false,
};

/** Builds a street's action sequence one step at a time via buttons - no free-text entry. */
export function ActionHistoryBuilder({ actionHistory, onAdd, onRemoveLast }: ActionHistoryBuilderProps) {
  const [position, setPosition] = useState<Position>(PREFLOP_ACTION_ORDER[0]);
  const [action, setAction] = useState<ActionType>("call");
  const [sizeBB, setSizeBB] = useState<number>(2.5);

  return (
    <div
      data-testid="action-history-builder"
      className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">アクション履歴</div>

      {actionHistory.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {actionHistory.map((event, i) => (
            <span
              key={i}
              className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
            >
              {event.position} {ACTION_LABEL_JA[event.action]}
              {event.sizeBB !== undefined ? ` ${event.sizeBB}BB` : ""}
            </span>
          ))}
          <button
            type="button"
            onClick={onRemoveLast}
            className="rounded bg-rose-100 px-2 py-1 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
          >
            1つ戻す
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {PREFLOP_ACTION_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPosition(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              position === p
                ? "bg-amber-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {ACTION_OPTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              action === a
                ? "bg-sky-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {ACTION_LABEL_JA[a]}
          </button>
        ))}
      </div>

      {NEEDS_SIZE[action] && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSizeBB((v) => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            −
          </button>
          <span className="w-16 text-center tabular-nums">{sizeBB}BB</span>
          <button
            type="button"
            onClick={() => setSizeBB((v) => Math.round((v + 0.5) * 2) / 2)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            +
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onAdd({ position, action, sizeBB: NEEDS_SIZE[action] ? sizeBB : undefined })}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        このアクションを追加
      </button>
    </div>
  );
}
