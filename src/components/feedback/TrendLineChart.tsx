"use client";

import { useState } from "react";
import { WeeklyMatchRate } from "@/engine/history/leakTrend";

const WIDTH = 320;
const HEIGHT = 120;
const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;
const GRID_RATES = [0, 0.5, 1];

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * A small hand-drawn SVG line chart of the overall match rate per week - see leakTrend.ts's
 * computeWeeklyMatchRate(). This is a single series (the overall trend, not broken out by
 * street/position), so no legend is needed - the section heading above already says what's
 * plotted (a single series needs no legend box). The first and last points are always directly
 * labeled; tap/hover any point for its exact value and sample count.
 */
export function TrendLineChart({ points }: { points: WeeklyMatchRate[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length < 2) return null;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_LEFT + (i / (points.length - 1)) * plotWidth;
  const y = (rate: number) => PAD_TOP + (1 - rate) * plotHeight;
  const rateOf = (p: WeeklyMatchRate) => p.matches / p.total;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(rateOf(p)).toFixed(1)}`).join(" ");
  const active = activeIndex !== null ? points[activeIndex] : null;
  // Sparse x-axis date labels - every point when there are few, otherwise just the ends - so
  // labels never crowd into illegibility (see marks-and-anatomy.md: label selectively).
  const showDateLabel = (i: number) => points.length <= 6 || i === 0 || i === points.length - 1;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-sm" role="img" aria-label="週ごとの一致率の推移">
        {GRID_RATES.map((g) => (
          <line
            key={g}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={y(g)}
            y2={y(g)}
            stroke="currentColor"
            strokeWidth={1}
            className="text-zinc-200 dark:text-zinc-800"
          />
        ))}
        {GRID_RATES.map((g) => (
          <text
            key={g}
            x={PAD_LEFT - 4}
            y={y(g)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-zinc-400 text-[8px] dark:fill-zinc-500"
          >
            {(g * 100).toFixed(0)}%
          </text>
        ))}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sky-500 dark:text-sky-400"
        />
        {points.map((p, i) => {
          const rate = rateOf(p);
          return (
            <g key={p.weekStart}>
              {/* Larger transparent hit target than the visible dot, per interaction.md - a
                  4px-radius dot is too small to tap reliably on a phone. */}
              <circle
                cx={x(i)}
                cy={y(rate)}
                r={10}
                fill="transparent"
                onClick={() => setActiveIndex(i === activeIndex ? null : i)}
                className="cursor-pointer"
              >
                <title>{`${formatWeekLabel(p.weekStart)}週: ${(rate * 100).toFixed(0)}% (${p.matches}/${p.total}件)`}</title>
              </circle>
              <circle
                cx={x(i)}
                cy={y(rate)}
                r={4}
                strokeWidth={2}
                className="pointer-events-none fill-sky-500 stroke-white dark:fill-sky-400 dark:stroke-zinc-900"
              />
              {(i === 0 || i === points.length - 1) && (
                <text
                  x={x(i)}
                  y={y(rate) - 8}
                  textAnchor={i === 0 ? "start" : "end"}
                  className="fill-zinc-600 text-[9px] font-semibold dark:fill-zinc-300"
                >
                  {(rate * 100).toFixed(0)}%
                </text>
              )}
              {showDateLabel(i) && (
                <text
                  x={x(i)}
                  y={HEIGHT - 4}
                  textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                  className="fill-zinc-400 text-[8px] dark:fill-zinc-500"
                >
                  {formatWeekLabel(p.weekStart)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {formatWeekLabel(active.weekStart)}週: {(rateOf(active) * 100).toFixed(0)}% ({active.matches}/{active.total}件)
        </p>
      )}
    </div>
  );
}
