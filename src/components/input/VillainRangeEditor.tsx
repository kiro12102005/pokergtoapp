"use client";

import { Position, PREFLOP_ACTION_ORDER } from "@/domain/table/seats";
import { Playstyle, PLAYSTYLE_LABEL_JA } from "@/engine/equity/handStrength";
import { DEFAULT_VILLAIN_RANGE_CONFIG, resolveVillainRange, VillainRangeConfig, VillainRangeMode } from "@/engine/equity/villainRangeConfig";
import { PlayerStack } from "@/engine/advisor/types";
import { RangeGridSelector } from "./RangeGridSelector";

export interface VillainRangeEditorProps {
  heroPosition: Position;
  otherPlayers: PlayerStack[];
  effectiveStackBB: number;
  villainRanges: Partial<Record<Position, VillainRangeConfig>>;
  selectedPosition: Position | null;
  onSelectPosition: (position: Position) => void;
  onSetMode: (position: Position, mode: VillainRangeMode) => void;
  onSetPercent: (position: Position, percent: number) => void;
  onSetPlaystyle: (position: Position, playstyle: Playstyle) => void;
  onToggleManualHand: (position: Position, hand: string) => void;
  onResetManualToDefault: (position: Position) => void;
  onClearManual: (position: Position) => void;
}

const MODE_OPTIONS: { value: VillainRangeMode; label: string }[] = [
  { value: "auto", label: "自動" },
  { value: "percent", label: "パーセント指定" },
  { value: "playstyle", label: "プレイスタイル" },
  { value: "manual", label: "手動指定" },
];

const PERCENT_PRESETS = [10, 15, 20, 25, 30, 40, 50, 70, 100];
const PLAYSTYLE_OPTIONS: Playstyle[] = ["nit", "tag", "lag", "loose_passive"];

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-sky-600 text-white"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Per-opponent-position range configuration for the GTO baseline calc (see
 * villainRangeConfig.ts). Each non-hero position can independently be set to auto (stage/stack
 * aware default), a manually-typed top-N% width, a playstyle preset (nit/TAG/LAG/loose-passive),
 * or the existing 13x13 manual grid - whichever position the GTO block ends up facing at a given
 * decision point (see potOdds.ts's facingPosition) uses that position's own config.
 */
export function VillainRangeEditor({
  heroPosition,
  otherPlayers,
  effectiveStackBB,
  villainRanges,
  selectedPosition,
  onSelectPosition,
  onSetMode,
  onSetPercent,
  onSetPlaystyle,
  onToggleManualHand,
  onResetManualToDefault,
  onClearManual,
}: VillainRangeEditorProps) {
  const candidatePositions = PREFLOP_ACTION_ORDER.filter((p) => p !== heroPosition);
  const activePosition = selectedPosition ?? candidatePositions[0];
  const config = villainRanges[activePosition] ?? DEFAULT_VILLAIN_RANGE_CONFIG;

  const villainStack = otherPlayers.find((p) => p.position === activePosition)?.stackBB;
  const effectiveStackForRange = villainStack ? Math.min(effectiveStackBB, villainStack) : effectiveStackBB;
  const playersRemaining = otherPlayers.length > 0 ? otherPlayers.length + 1 : undefined;
  const resolved = resolveVillainRange(config, activePosition, effectiveStackForRange, playersRemaining);

  return (
    <div
      data-testid="villain-range-editor"
      className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        相手のレンジ(GTO的視点の計算に使用・プレイヤーごとに設定可能)
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {candidatePositions.map((position) => {
          const positionConfig = villainRanges[position];
          const customized = positionConfig && positionConfig.mode !== "auto";
          return (
            <button
              key={position}
              type="button"
              onClick={() => onSelectPosition(position)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activePosition === position
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {position}
              {customized && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-1">
        {MODE_OPTIONS.map((opt) => (
          <TabButton key={opt.value} active={config.mode === opt.value} onClick={() => onSetMode(activePosition, opt.value)}>
            {opt.label}
          </TabButton>
        ))}
      </div>

      {config.mode === "percent" && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetPercent(activePosition, config.percent - 5)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              −
            </button>
            <span className="w-14 text-center text-base font-semibold tabular-nums">{config.percent}%</span>
            <button
              type="button"
              onClick={() => onSetPercent(activePosition, config.percent + 5)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {PERCENT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetPercent(activePosition, p)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  config.percent === p
                    ? "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {config.mode === "playstyle" && (
        <div className="flex flex-wrap justify-center gap-1">
          {PLAYSTYLE_OPTIONS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onSetPlaystyle(activePosition, style)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                config.playstyle === style
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {PLAYSTYLE_LABEL_JA[style]}
            </button>
          ))}
        </div>
      )}

      {config.mode === "manual" && (
        <RangeGridSelector
          selectedHands={config.manualHands}
          onToggleHand={(hand) => onToggleManualHand(activePosition, hand)}
          onResetToDefault={() => onResetManualToDefault(activePosition)}
          onClear={() => onClearManual(activePosition)}
        />
      )}

      {config.mode !== "manual" && (
        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">{resolved.description}</p>
      )}
    </div>
  );
}
