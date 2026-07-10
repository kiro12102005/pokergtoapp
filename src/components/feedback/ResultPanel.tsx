import { ScenarioState } from "@/domain/scenario/scenarioState";
import { FrequencyBar } from "./FrequencyBar";

export interface ResultPanelProps {
  scenario: ScenarioState;
  onNextHand: () => void;
}

export function ResultPanel({ scenario, onNextHand }: ResultPanelProps) {
  if (!scenario.solverRecommendation || !scenario.userAction) return null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow dark:border-zinc-700 dark:bg-zinc-900">
      <div
        className={`text-lg font-bold ${
          scenario.isCorrect ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {scenario.isCorrect ? "正解!" : "不正解"}
      </div>
      <div className="w-full">
        <div className="mb-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
          ソルバー推奨頻度
        </div>
        <FrequencyBar mix={scenario.solverRecommendation} />
      </div>
      <button
        type="button"
        onClick={onNextHand}
        className="mt-1 rounded-lg bg-zinc-900 px-6 py-2 text-sm font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        次のハンド
      </button>
    </div>
  );
}
