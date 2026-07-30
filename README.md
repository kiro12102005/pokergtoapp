# Poker Chase クラブマッチ GTOトレーナー

6人打ちのクラブマッチ形式に特化した、プリフロップ戦略のトレーニング＆分析アプリです。

**🔗 Live Demo: [pokergtoapp-green.vercel.app](https://pokergtoapp-green.vercel.app)**

## これは何？

プリフロップの最適戦略（GTO）をクイズ形式で練習し、実際のハンドを自分で入力してAIにフィードバックをもらえるWebアプリです。現在は Phase 1（プリフロップ特化）として公開しています。

## 主な機能

### 🎯 練習モード（`/train`）
- CFR（Counterfactual Regret Minimization）で事前計算したプリフロップソルバーの答えを元に、ランダムに配られたハンド・ポジション・スタック状況に対して最適アクションをクイズ形式で回答
- 回答するとソルバーの推奨頻度（レイズ/コール/フォールドの混合戦略）と答え合わせを表示
- ポジション・スタック深度を指定してのハンド生成にも対応

### 🔍 分析モード（`/analyze`）
- ポジション・スタック・アクション履歴・ボードカードなど任意のシチュエーションを自分で組み立てて入力可能
- プリフロップはソルバーの計算結果、フロップ以降は Gemini API を使ったAIアドバイザーが状況を読み取り、推奨アクションと根拠を返す
- Gemini APIキーはブラウザのローカルストレージにのみ保存され、サーバーには送信されない（利用者自身のAPIキーが必要）
- 他のAIチャットに貼り付けて相談できるよう、状況をプロンプト化してコピーする機能も搭載

## 技術スタック

| 領域 | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript |
| スタイリング | Tailwind CSS v4 |
| 状態管理 | Zustand |
| バリデーション | Zod |
| AI連携 | Google Gemini API (`@google/genai`) |
| ロジック | 自前実装のハンド評価・エクイティ計算・CFRソルバー・ICM計算 |
| テスト | Vitest |

### アーキテクチャのポイント
- `src/engine/solver` : プリフロップ用のCFRソルバーとプッシュ/フォールドソルバー。`scripts/precompute-preflop.ts` で事前計算し、`src/data/solverOutput` にJSONとして格納することで実行時は瞬時に参照可能
- `src/engine/equity` : 7枚評価によるハンド強度・レンジエクイティ計算
- `src/engine/advisor` : Gemini APIへのプロンプト構築・レスポンスのスキーマ検証（Zod）を担当し、フロップ以降の状況判断を担う
- `src/domain` : カード・シナリオ・テーブルなどのドメインロジックをUIから分離

## セットアップ

```bash
npm install

# プリフロップソルバーの事前計算（初回のみ／solverOutput更新時）
npm run precompute:preflop

# 開発サーバー起動
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと確認できます。分析モードでポストフロップのAIフィードバックを使うには、[Google AI Studio](https://aistudio.google.com/apikey) で取得した無料のGemini APIキーをアプリ内の設定から入力してください。

## テスト

```bash
npm run test
```

ハンド評価・エクイティ計算・ポットオッズ・ICM・アドバイザーのプロンプト/スキーマなど、コアロジックをVitestでカバーしています。

## デプロイ

[Vercel](https://vercel.com) にデプロイ済みです。Next.jsプロジェクトのため `vercel` にリポジトリを接続するだけでそのままデプロイできます。
