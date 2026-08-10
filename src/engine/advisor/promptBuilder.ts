import { cardToDisplayString } from "@/domain/cards/card";
import { ACTION_LABEL_JA, STREET_LABEL_JA } from "@/domain/scenario/labels";
import { ActionEvent, Street } from "@/domain/scenario/scenarioState";
import { Position } from "@/domain/table/seats";
import { describeHandCategoryJa, evaluateBestHand } from "@/engine/equity/handDescription";
import { icmEquity } from "@/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "@/engine/icm/pointsVector";
import { AdvisorSituation, PlayerStack } from "./types";

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

function formatStreetActions(actions: ActionEvent[]): string {
  if (actions.length === 0) return "(アクションなし)";
  return actions
    .map((event) => {
      const sizeSuffix = event.sizeBB !== undefined ? ` ${event.sizeBB}BB` : "";
      return `${event.position}: ${ACTION_LABEL_JA[event.action]}${sizeSuffix}`;
    })
    .join(" → ");
}

/** Formats the full hand's action history up to and including the current street, one line
 *  per street, so the advisor sees the whole story rather than just the current street. */
function formatFullActionHistory(
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>,
  currentStreet: Street
): string {
  const lines: string[] = [];
  for (const street of STREET_ORDER) {
    lines.push(`  ${STREET_LABEL_JA[street]}: ${formatStreetActions(actionsByStreet[street] ?? [])}`);
    if (street === currentStreet) break;
  }
  return lines.join("\n");
}

/**
 * Computes each remaining player's expected club-match points (same icmEquity() math and
 * CLUB_MATCH_POINTS_VECTOR Phase 1's exact preflop solver uses) and renders it as a table for
 * the prompt, so the LLM reasons about real ICM pressure from the actual stack distribution
 * instead of the precomputed table's symmetric-stacks approximation.
 */
function formatIcmContext(heroPosition: Position, heroStackBB: number, otherPlayers: PlayerStack[]): string {
  const allPlayers: PlayerStack[] = [{ position: heroPosition, stackBB: heroStackBB }, ...otherPlayers];
  const stacks = allPlayers.map((p) => p.stackBB);
  const payouts = CLUB_MATCH_POINTS_VECTOR.slice(0, allPlayers.length);
  const pointsEV = icmEquity(stacks, payouts);

  const rows = allPlayers
    .map((p, i) => `  - ${p.position}${p.position === heroPosition ? "(ヒーロー)" : ""}: ${p.stackBB}BB, 期待ポイント ${pointsEV[i].toFixed(2)}`)
    .join("\n");

  return `## ICM状況(クラブマッチのポイント制、残り${allPlayers.length}人)
順位ポイント: ${payouts.join(" / ")}(1位から順)
${rows}
上記の期待ポイントの変動も踏まえて、チップEVだけでなくICM(順位ポイント)への影響を考慮した推奨をしてください。`;
}

export const ADVISOR_SYSTEM_PROMPT = `あなたはポーカー(ノーリミットホールデム、クラブマッチ形式)の**エクスプロイト**戦略アドバイザーです。
GTO(理論上の均衡)寄りの判断材料 - ポットオッズから求めた必要勝率と、想定レンジに対するヒーローの
実際のエクイティ - は別途「GTOベースライン」として計算済みの数値で渡されます。あなたの役割はその
数値を土台としつつ、実際のクラブマッチのプレイヤーの傾向や、ユーザーから渡された相手の具体的な情報を
踏まえて「実戦でどう調整すべきか」というエクスプロイト的な視点を加えることです。

クラブマッチ(カジュアルなトーナメント形式)のプレイヤーによく見られる一般的な傾向:
- ベット/レイズはバリューハンドに偏りがちで、特にリバーのブラフ頻度は理論値より低いことが多い
- トップペア以上を掴むと降りにくく、コーリングステーション寄りの傾向が出やすい
- プリフロップのオープンレンジは理論値よりタイトな層と、逆に広すぎる層が混在しやすい
- これらはあくまで一般論。相手の具体的な情報(補足情報)が与えられた場合は、一般論よりそちらを優先すること。

クラブマッチは順位に応じたポイント制であり、ICM(独立チップモデル)の影響が大きいトーナメントです。
他のプレイヤーのスタック情報(期待ポイント付き)が与えられた場合は、単純なチップEVではなく、
ICMを踏まえたリスク回避(バブル要因やペイジャンプ)も考慮に入れてください。

制約:
- 「ヒーローの現在の役」が与えられている場合、それは正確に計算済みの確定事実です。自分で役を再計算せず、必ずその役をそのまま前提として推奨を組み立てること。
- 「GTOベースライン」が与えられている場合、その数値を自分で再計算せず前提とし、そこからのエクスプロイト的な調整(頻度をどちらに寄せるか)を理由で明示すること。
- 出力は必ず指定されたJSONスキーマに従うこと。
- frequenciesのキーは "fold" / "check" / "call" / "raise" / "shove" のうち、この局面で選択可能なものだけを含めること。
  - "raise" というキー名だが、これは「このストリートでまだ誰もベットしていない状況で先制的に賭ける(ベット)」と「相手が既にベットした後にそれを上回る額を賭ける(レイズ)」の両方を表す。どちらに該当するかは「このストリートの状況」の行に明記されるので、それに厳密に従うこと。まだ誰もベットしていない状況を「レイズ」と表現したり、その逆をしたりしないこと(rationale内の言葉遣いも同様)。
  - 「このストリートの状況」が「まだ誰もベットしていない」で、かつヒーローが直前のストリートのアグレッサーでない場合、先制ベットは「ドンクベット」に該当する。該当する場合は rationale でその旨とその妥当性に触れること。
- frequenciesにraise(ベットまたはレイズ)が0より大きい値で含まれる場合、sizePercentPot に推奨サイズを1つ、この意思決定直前のポット(potBB)に対する割合(%)の数値で指定すること。例えば直前のポットが10BBで6.6BBを賭けるなら66。raiseの頻度が0または存在しない場合はsizePercentPotを省略すること。rationale内でサイズの数値を繰り返す必要はない(数値はsizePercentPotに構造化して渡すこと)。
- frequenciesの値の合計は1に近い値にすること(誤差0.05以内)。
- rationale は日本語で2〜4文程度、簡潔に。GTOベースラインからどちらの方向にどう調整したか、その根拠(相手の傾向・補足情報・ICM)に触れること。
- 「ヒーローが実際に取った行動」が与えられている場合、それが推奨(frequenciesの中で最も高いアクション)と一致するかを明示的に評価し、rationale内で必ず触れること。一致しない場合はなぜ推奨の方が優れているか(または実際の行動にも理がある場合はその点も)を具体的に説明し、一致する場合もその判断が良かった理由に触れること。
- これは正式なGTOソルバーの解ではなく、あなたの知識に基づく近似的なエクスプロイト的アドバイスであることを踏まえた回答にすること。
- 同じ、または似た局面を繰り返し聞かれた場合でも、一貫して同じ結論(頻度・サイズ・理由の方向性)を返すこと。ランダムに変える必要はない。`;

/**
 * Builds the situation-description block shared by buildAdvisorPrompt() (this app's own Gemini
 * call, which appends JSON-output instructions) and buildExternalPrompt() (the copy-pasteable
 * version for external AI chats, which appends a plain-language question instead) - so both stay
 * in sync on what facts describe the hand instead of maintaining two copies.
 */
export function buildSituationText(situation: AdvisorSituation): string {
  const heroHandStr = situation.heroCards.map(cardToDisplayString).join(" ");
  const boardStr =
    situation.board.length > 0
      ? situation.board.map(cardToDisplayString).join(" ")
      : "(ボードなし)";

  // Tell the model hero's actual best-hand category as a computed fact (exact evaluator, not
  // LLM guesswork) - smaller models can misread a made hand (e.g. calling a two-pair board a
  // straight), so this line removes that failure mode for the "what do I have" part entirely.
  const madeHandLine =
    situation.board.length >= 3
      ? `- ヒーローの現在の役(計算済み、確定事実): ${describeHandCategoryJa(evaluateBestHand([...situation.heroCards, ...situation.board]))}\n`
      : "";

  // Tells the model, as a stated fact rather than something it has to infer from the raw
  // action list, whether this decision is "facing a bet" (call/raise/fold - use レイズ wording)
  // or "nobody has bet this street yet" (check/bet - use ベット wording, and possibly a donk
  // bet) - see the system prompt's raise-terminology rule. Only meaningful/set postflop.
  const facingBetLine =
    situation.street !== "preflop" && situation.facingBet !== undefined
      ? `- このストリートの状況: ${
          situation.facingBet
            ? "相手が既にベットしており、ヒーローはコール/レイズ/フォールドを検討している(「レイズ」の語を使うこと)。"
            : "このストリートではまだ誰もベットしていない。ヒーローはチェックまたはベットを検討している(「ベット」の語を使うこと。「レイズ」は使わないこと)。"
        }\n`
      : "";

  // Lets the model's rationale directly address hero's real choice ("you called, but folding
  // was better because...") instead of producing a recommendation blind to what was actually
  // done - see the system prompt's matching instruction.
  const actualActionLine = situation.actualAction
    ? `- ヒーローが実際に取った行動: ${situation.actualAction.position} ${ACTION_LABEL_JA[situation.actualAction.action]}${
        situation.actualAction.sizeBB !== undefined ? ` ${situation.actualAction.sizeBB}BB` : ""
      }\n`
    : "";

  const icmSection =
    situation.otherPlayers && situation.otherPlayers.length > 0
      ? `\n${formatIcmContext(situation.heroPosition, situation.effectiveStackBB, situation.otherPlayers)}\n`
      : "";

  const gto = situation.gtoBaseline;
  const gtoSection = gto
    ? `\n## GTOベースライン(計算済み、確定事実)
必要勝率(ポットオッズ): ${(gto.requiredEquity * 100).toFixed(1)}%
ヒーローの実際のエクイティ(${gto.rangeDescription}に対して): ${(gto.heroEquity * 100).toFixed(1)}%
→ 純粋な期待値だけで見た場合の目安: ${
        gto.heroEquity > gto.requiredEquity ? "コールが有利" : "フォールドが有利"
      }(僅差の場合は五分と考えること)
`
    : "";

  return `## シチュエーション
- ストリート: ${STREET_LABEL_JA[situation.street]}
- ヒーローのポジション: ${situation.heroPosition}
- 有効スタック: ${situation.effectiveStackBB}BB
- ポット: ${situation.potBB}BB
- ボード: ${boardStr}
- ヒーローのハンド: ${heroHandStr}
${madeHandLine}${facingBetLine}- ここまでのアクション履歴:
${formatFullActionHistory(situation.actionsByStreet, situation.street)}
${actualActionLine}${situation.extraContext ? `- 補足情報: ${situation.extraContext}` : ""}
${icmSection}${gtoSection}`;
}

/**
 * Builds the {system, user} prompt pair for an LLM postflop advisor call. Pure and
 * network-free so it can be unit tested without hitting any API.
 */
export function buildAdvisorPrompt(situation: AdvisorSituation): { system: string; user: string } {
  const user = `${buildSituationText(situation)}
上記のシチュエーションについて、GTOベースラインを踏まえたエクスプロイト的な推奨アクション頻度と理由をJSONで返してください。`;

  return { system: ADVISOR_SYSTEM_PROMPT, user };
}

/**
 * Builds a single copy-pasteable prompt for pasting into an external AI chat (Gemini, Claude,
 * ...), unlike buildAdvisorPrompt() this deliberately omits ADVISOR_SYSTEM_PROMPT (this app's
 * internal persona/JSON-output-schema instructions and club-match-persona framing aren't useful
 * to a general chat) and closes with a plain-language question instead of a JSON-output
 * directive - only the play-relevant facts (position, stacks, actions, board, hand) carry over.
 */
export function buildExternalPrompt(situation: AdvisorSituation): string {
  return `${buildSituationText(situation)}
このハンドについて、おすすめのアクションとその理由を教えてください。`;
}
