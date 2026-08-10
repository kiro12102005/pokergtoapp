import { ACTION_LABEL_JA } from "@/domain/scenario/labels";
import { ActionType, StrategyMix } from "@/domain/scenario/scenarioState";
import { buildSituationText } from "./promptBuilder";
import { AdvisorSituation } from "./types";

/**
 * Unlike ADVISOR_SYSTEM_PROMPT (an exploit-adjustment advisor that computes its own
 * frequencies), this prompt is for explaining an *already-known, exact* answer - the preflop
 * trainer's precomputed CFR-solved frequencies (see solverLookup.ts) - in plain-language theory
 * terms. The model isn't asked to (and is told not to) recompute or second-guess the numbers.
 */
export const EXPLAIN_SYSTEM_PROMPT = `あなたはポーカー(ノーリミットホールデム、クラブマッチ形式)のプリフロップ理論解説者です。

渡されるアクション頻度は、事前計算されたCFRソルバーによる厳密解であり、正確な計算結果です。あなたの役割はその数値を自分で再計算したり疑問視したりすることではなく、なぜその頻度が理論的に妥当なのかを、ポジション・想定レンジ・スタック深度・(ICM情報があれば)順位ポイントへの影響といった一般的なプリフロップ理論の観点からわかりやすく解説することです。

制約:
- 与えられた頻度をそのまま確定事実として前提とし、それ自体を再計算・変更しないこと。
- 「ヒーローが実際に取った行動」が与えられている場合、それが頻度の中でどう位置づけられるか(最も高い頻度のアクションと一致するか、一定の頻度で許容される範囲内か、それとも明確な間違いか)に必ず具体的に触れること。間違いに近い場合はなぜ他の選択肢の方が優れているかを説明し、良い選択だった場合もその理由に触れること。
- 解説は日本語で3〜5文程度。「レンジ」「エクイティ」「ブロッカー」等の用語は使ってよいが、初心者にも伝わるよう噛み砕くこと。
- JSON以外の説明文は出力しないこと。`;

function formatFrequencies(mix: StrategyMix): string {
  return (Object.entries(mix) as [ActionType, number | undefined][])
    .filter((entry): entry is [ActionType, number] => (entry[1] ?? 0) > 0)
    .map(([action, value]) => `${ACTION_LABEL_JA[action]} ${(value * 100).toFixed(0)}%`)
    .join(" / ");
}

/** Builds the {system, user} prompt pair for explaining an already-solved frequency mix - see
 *  explainAdvisor.ts's getPreflopExplanation(). Reuses buildSituationText() (the same situation
 *  facts buildAdvisorPrompt()/buildExternalPrompt() use) so all three prompts stay in sync on how
 *  a hand is described. */
export function buildExplainPrompt(situation: AdvisorSituation, frequencies: StrategyMix): { system: string; user: string } {
  const user = `${buildSituationText(situation)}
## 事前計算済みのソルバーの厳密解(確定事実、再計算しないこと)
${formatFrequencies(frequencies)}

上記の頻度がなぜ妥当なのか、プリフロップ理論の観点から解説してください。`;

  return { system: EXPLAIN_SYSTEM_PROMPT, user };
}
