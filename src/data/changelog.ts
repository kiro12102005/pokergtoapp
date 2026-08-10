export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD) - also used as the unread/seen comparison key, so keep entries sorted
   *  newest-first and never reuse/backdate a date once published (see changelogStore.ts). */
  date: string;
  title: string;
  description: string;
}

/** Newest first. Add a new entry here whenever a notable feature/fix ships - see
 *  changelogStore.ts / NavBar.tsx for how this drives the "お知らせ" unread badge. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-11",
    title: "傾向分析(リークファインダー)ページを追加",
    description:
      "履歴ページから「傾向分析」に進むと、保存した分析結果の実際の選択とAI/GTOの推奨がストリート別・ポジション別にどれだけ一致していたか、またプリフロップ練習の正答率の推移・ポジション別成績を確認できます(要ログイン)。",
  },
  {
    date: "2026-08-11",
    title: "お知らせ機能を追加",
    description: "このページ自体です。今後のアップデートはここに追記していきます。",
  },
  {
    date: "2026-08-11",
    title: "ポストフロップ練習にターン・リバー、マルチウェイポットを追加",
    description:
      "これまでフロップの局面のみだった練習モードが、ターン・リバーの局面も出題されるようになりました。3人がプリフロップに絡み、フロップで1人フォールドする「マルチウェイポット」も一定確率で出題されます。",
  },
  {
    date: "2026-08-11",
    title: "プリフロップ練習に「なぜ?」AI解説ボタンを追加",
    description:
      "練習モードの結果画面に「なぜ?(AIに解説してもらう)」ボタンを追加。事前計算された正解の頻度はそのままに、なぜその頻度が理論的に妥当か、あなたの選択がどう位置づけられるかをAIが解説します(要Gemini APIキー、押さない限り無料)。",
  },
  {
    date: "2026-08-10",
    title: "トップページを刷新、スマホ対応(PWA化)",
    description:
      "トップページのデザインを一新。ホーム画面に追加できるPWA対応(アイコン・マニフェスト追加)や、スマホ画面でのレイアウト崩れの修正も行いました。",
  },
  {
    date: "2026-08-10",
    title: "ハンド分析履歴機能を追加",
    description:
      "分析モードの結果を保存し、後から見返せる「履歴」ページを追加しました。メールアドレスでのログインに対応し、保存した内容や外部AI用プロンプートをいつでも確認・コピーできます。",
  },
  {
    date: "2026-08-09",
    title: "外部AI用プロンプートを簡潔化",
    description:
      "分析モードの「外部AI用プロンプートをコピー」機能が、内部的なAI向け指示文を含まず、ポジション・スタック・アクションなどプレイに関する情報だけに絞られるようになりました。",
  },
];
