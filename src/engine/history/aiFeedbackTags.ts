/** Suggested leak-category labels for tagging a hand's aiFeedback (see AiFeedbackPanel.tsx) -
 *  just a starting menu of common leaks to tap instead of typing, not an enum: users can also
 *  type their own free-text tag, and HandRecord.tags stores whatever they end up with. */
export const SUGGESTED_AI_FEEDBACK_TAGS: string[] = [
  "C-Bet過剰",
  "C-Bet頻度不足",
  "3Betポットの判断",
  "ブラフ頻度",
  "バリューベットが薄い",
  "ポジション意識",
  "ベットサイズ選択",
  "レンジ読み違い",
  "フォールド過多",
  "コール過多",
];
