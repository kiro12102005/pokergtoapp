/** Bridges Japanese poker-club slang to the standard GTO/English terms this app's UI and AI
 *  feedback use - rendered on /help. English tools (GTO Wizard etc.) don't localize this, so it's
 *  one of the few genuinely JP-audience-specific pieces of content in the app. */
export interface GlossaryEntry {
  ja: string;
  en: string;
  description: string;
}

export const POKER_GLOSSARY: GlossaryEntry[] = [
  { ja: "刺す / 刺しに行く", en: "3ベット (3-bet)", description: "相手のレイズに対してさらにレイズを入れること。" },
  {
    ja: "絞る",
    en: "スクイーズ (Squeeze)",
    description: "オープンレイズとそれへのコールが入った後、その両方に対して大きめにレイズすること。",
  },
  {
    ja: "開ける / オープンする",
    en: "オープンレイズ (Open Raise)",
    description: "まだ誰もレイズしていない状況で、最初にレイズしてポットに参加すること。",
  },
  {
    ja: "リンパ / リンプする",
    en: "リンプ (Limp)",
    description: "レイズせず最低ベット額でコールしてプリフロップに参加すること。多くの状況でGTO的には非推奨。",
  },
  {
    ja: "叩く",
    en: "連続ベット / C-bet",
    description: "強くベット・レイズで攻めること。前のストリートのアグレッサーが続けてベットする意味で使われることが多い。",
  },
  {
    ja: "置く",
    en: "チェック / 弱いベット",
    description: "ベットせずチェックすること、またはポットに対して小さすぎるベットを打つことを指す。",
  },
  {
    ja: "ペラい",
    en: "薄いバリュー (Thin Value)",
    description: "ハンドの勝率・強さが低いこと。「ペラいバリューベット」は薄い勝率でのバリューベットを指す。",
  },
  {
    ja: "コーラー / コーリングステーション",
    en: "Calling Station",
    description: "フォールドやレイズをせず頻繁にコールする受動的な相手。バリューを厚く、ブラフを控えて対応する。",
  },
  { ja: "レンジ", en: "Range", description: "ある状況で相手(または自分)が持ちうるハンドの集合。" },
  {
    ja: "ポラライズ(されたレンジ)",
    en: "Polarized Range",
    description: "強いハンドと弱いハンド(ブラフ用)の二極に分かれ、中間の強さのハンドが少ないレンジ。",
  },
  {
    ja: "リニア(なレンジ)",
    en: "Linear / Merged Range",
    description: "強いハンドから弱いハンドまで、強さの順に連続的に構成されたレンジ。",
  },
  { ja: "バリューベット", en: "Value Bet", description: "相手にコールされて勝つことを期待して打つベット。" },
  {
    ja: "セミブラフ",
    en: "Semi-bluff",
    description: "今は最強ではないが、後のストリートで強くなる可能性(アウツ)を持つハンドでのブラフ。",
  },
  {
    ja: "C-bet(シーベット)",
    en: "Continuation Bet",
    description: "プリフロップのアグレッサーが、フロップ以降も続けてベットすること。",
  },
  {
    ja: "ドンクベット",
    en: "Donk Bet",
    description: "前のストリートのアグレッサーでなかったプレイヤーが、相手より先にベットすること。",
  },
  {
    ja: "SPR",
    en: "Stack-to-Pot Ratio",
    description: "有効スタックをポットサイズで割った値。低いほどオールインしやすく、意思決定がシンプルになる。",
  },
  {
    ja: "ICM",
    en: "Independent Chip Model",
    description: "トーナメントでチップ量を賞金期待値($EV)に変換する考え方。バブル間近などチップの価値が非線形になる場面で重要。",
  },
  {
    ja: "エクスプロイト",
    en: "Exploit",
    description: "GTOから意図的に外れ、相手の傾向の偏り(コールしすぎ・降りすぎ等)を突いてEVを最大化する戦略。",
  },
];
