import { ACTION_LABEL_JA, STREET_LABEL_JA } from "@/domain/scenario/labels";
import { AnalyzeResultDisplay, GtoResult } from "@/state/analyzeStore";
import { FrequencyBar } from "./FrequencyBar";

export interface AdvisorResultPanelProps {
  results: AnalyzeResultDisplay[];
}

const VERDICT_LABEL: Record<GtoResult["verdict"], string> = {
  call: "コール(期待値プラス)",
  fold: "フォールド(期待値マイナス)",
  marginal: "五分(僅差)",
};

const VERDICT_COLOR: Record<GtoResult["verdict"], string> = {
  call: "text-emerald-600",
  fold: "text-rose-600",
  marginal: "text-amber-600",
};

function GtoBlock({ gto }: { gto: GtoResult }) {
  return (
    <div className="flex w-full flex-col gap-1 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs dark:border-sky-900 dark:bg-sky-950">
      <div className="font-semibold text-sky-700 dark:text-sky-300">GTO的視点(計算値・チップEVベース)</div>
      <div className="text-zinc-600 dark:text-zinc-300">
        必要勝率(ポットオッズ): <span className="font-semibold">{(gto.requiredEquity * 100).toFixed(1)}%</span>
        {" / "}
        実際のエクイティ: <span className="font-semibold">{(gto.heroEquity * 100).toFixed(1)}%</span>
      </div>
      <div className="text-zinc-500 dark:text-zinc-400">{gto.rangeDescription}に対して(簡易的な想定)</div>
      <div className={`font-bold ${VERDICT_COLOR[gto.verdict]}`}>{VERDICT_LABEL[gto.verdict]}</div>
    </div>
  );
}

/**
 * Each hero decision point found in the entered hand gets its own card - e.g. a street where
 * hero checked and later called a raise produces two separate recommendations, one per
 * decision, rather than a single verdict for the whole street (see decisionPoints.ts).
 *
 * Each card can show two independent views: a "GTO" block (gto - pot odds vs computed equity,
 * entirely code-computed, no LLM) and an "exploit" block (frequencies/rationale - the LLM's
 * recommendation, informed by the GTO numbers plus population tendencies and any villain notes).
 */
export function AdvisorResultPanel({ results }: AdvisorResultPanelProps) {
  if (results.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      {results.map((result, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-bold">{STREET_LABEL_JA[result.street]}</div>
            {result.actualAction ? (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                あなたの選択: {result.actualAction.position} {ACTION_LABEL_JA[result.actualAction.action]}
                {result.actualAction.sizeBB !== undefined ? ` ${result.actualAction.sizeBB}BB` : ""}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">この時点でヒーローが取るべきアクション</div>
            )}
          </div>

          {result.gto && <GtoBlock gto={result.gto} />}

          {result.source === "error" ? (
            <div className="rounded-lg border border-rose-400 bg-rose-50 p-2 text-center text-xs text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {result.errorMessage ?? "分析に失敗しました。"}
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-3">
              {result.source === "exact" ? (
                <div className="text-xs font-semibold text-emerald-600">事前計算テーブルによる厳密解</div>
              ) : (
                <div className="text-xs font-semibold text-amber-600">
                  AIによるエクスプロイト視点(正式なGTOソルバーの解ではありません)
                </div>
              )}
              {result.facingBet === false && (
                <div className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                  このストリートではまだ誰もベットしていません(ヒーローが先にアクションします)
                </div>
              )}
              {result.frequencies && (
                <div className="w-full">
                  <FrequencyBar
                    mix={result.frequencies}
                    raiseLabel={result.facingBet === false ? "BET" : result.facingBet === true ? "RAISE" : undefined}
                    raiseSizeLabel={result.sizePercentPot !== undefined ? `pot ${result.sizePercentPot.toFixed(0)}%` : undefined}
                  />
                </div>
              )}
              {result.rationale && (
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{result.rationale}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
