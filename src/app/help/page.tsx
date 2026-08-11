"use client";

interface HelpSection {
  title: string;
  body: string;
}

const SECTIONS: HelpSection[] = [
  {
    title: "GTOベースラインとAIのエクスプロイト提案の違い",
    body: "「GTO的視点」は、ポットオッズから計算した必要勝率と、想定レンジに対するヒーローの実際のエクイティを、AIを使わずこのアプリが計算した値です。「AIによるエクスプロイト視点」はそのGTOの数値を土台にしつつ、クラブマッチでよくある相手の傾向(コーリングステーション寄り、リバーのブラフ頻度が低い等)を踏まえてAIが提案する調整後の頻度です。どちらも参考値であり、AI側は正式なGTOソルバーの厳密解ではありません。",
  },
  {
    title: "有効スタックとポット",
    body: "有効スタックは、ヒーローと相手のうち少ない方のスタック(BB換算)です。分析ページではハンド開始時点の有効スタックとポット(ブラインド+アンティ)を入力し、それ以降のポットはアクション履歴から自動計算されます。",
  },
  {
    title: "分析モードの使い方",
    body: "実際にプレイしたハンドの状況(ポジション・スタック・アクション履歴・ボード)を入力すると、プリフロップは事前計算されたソルバーの厳密解、ポストフロップ(または相手のスタック情報を入力したICM絡みの状況)はAIによる推奨を確認できます。ログインすると結果を履歴に保存でき、各ハンドは「共有」をONにするとログイン不要の読み取り専用リンクを発行できます。履歴ページからは保存済みの全件をJSON/CSVでも書き出せます。",
  },
  {
    title: "練習モードの使い方",
    body: "「プリフロップ」タブは事前計算された厳密解に基づく練習、「ポストフロップ」タブはフロップ・ターン・リバーいずれかの局面(GTOベースライン+AIのエクスプロイト評価)を練習できます。ポストフロップの絞り込み(局面の種類・ストリート・ポジション)を使うと、特定の状況だけを集中して練習できます。",
  },
  {
    title: "傾向分析(リークファインダー)の見方",
    body: "履歴ページの「傾向分析」では、保存した分析結果のうち実際に選択したアクションが推奨と一致した割合を、ストリート別・ポジション別に集計します。週ごとの推移グラフも表示され、上達しているかを確認できます。一致率が低い項目には「練習する」リンクが表示され、その弱点をそのまま練習モードで出題できます。件数が少なすぎる項目(3件未満)は誤解を避けるため非表示になります。",
  },
  {
    title: "APIキーの設定(Gemini/Claude)",
    body: "ポストフロップ分析・練習にはGeminiまたはClaudeのAPIキーが必要です。分析・練習ページ上部のキー設定欄でどちらかを選び、ご自身のAPIキーを貼り付けてください。キーはこのブラウザにのみ保存され、サーバーには送信されません。Geminiには無料枠がありますが、Claudeにはありません(従量課金)。",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-bold">使い方</h1>
        <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-400">
          このアプリの基本的な考え方と各ページの使い方をまとめています。
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="flex flex-col gap-1 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">{s.title}</h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
