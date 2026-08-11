import { test, expect } from "@playwright/test";

/**
 * Everything here works without a saved Gemini/Claude API key and without a logged-in Supabase
 * session, so it can run unattended in any environment (including CI with no secrets at all).
 * See auth-flow.spec.ts for the save -> share -> delete flow, which does need a Supabase session.
 */

test("home page renders and links to the three main sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /GTO.*エクスプロイト.*トレーナー/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "練習を始める" })).toBeVisible();
  await expect(page.getByRole("link", { name: "シチュエーションを分析する" })).toBeVisible();
});

test("desktop nav links navigate to each page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
  for (const [label, path] of [
    ["練習", "/train"],
    ["分析", "/analyze"],
    ["履歴", "/history"],
    ["ヘルプ", "/help"],
    ["お知らせ", "/updates"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
  }
});

test("mobile viewport shows the bottom tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeVisible();
});

test("analyze page: sample hand button produces a GTO result with no API key configured", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByRole("button", { name: "サンプルハンドを試す" }).click();
  await page.getByRole("button", { name: "分析する" }).click();
  // The GTO block is computed client-side (no LLM call) - it should appear even with no API key
  // saved in this fresh browser context. The AI-exploit block below it is expected to show an
  // error instead ("APIキーが設定されていません" / "を設定してください") in that case.
  await expect(page.getByText("計算値・チップEVベース")).toBeVisible({ timeout: 15_000 });
});

test("preflop trainer: exact-table quiz produces a correct/incorrect verdict", async ({ page }) => {
  await page.goto("/train");
  // Force a well-covered position/depth combo so the exact-table lookup reliably hits (rather
  // than occasionally landing on an uncomputed combination and showing the "未計算" notice).
  // "BTN"/"100BB" each match one button before a scenario loads; force via the filter row that
  // renders first in the DOM (the position selector, then the stack-depth selector) - the
  // pre-loaded scenario's own StackStepper further down the page also has a "100BB" preset
  // button, hence .first() here.
  await page.getByRole("button", { name: "BTN", exact: true }).click();
  await page.getByRole("button", { name: "100BB", exact: true }).first().click();
  await page.getByRole("button", { name: "New Hand" }).click();

  await page.locator("button", { hasText: /^(FOLD|CALL|CHECK|RAISE|ALL IN)/ }).first().click();
  await expect(page.getByText(/^(正解!|不正解)$/)).toBeVisible();
});

test("postflop trainer: prompts for an API key when none is configured", async ({ page }) => {
  await page.goto("/train");
  await page.getByRole("button", { name: "ポストフロップ" }).click();
  await expect(page.getByText(/APIキーが必要です/)).toBeVisible();
});

test("dark mode toggle cycles system -> light -> dark and applies the html class", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /表示テーマ/ });
  const html = page.locator("html");

  await toggle.click(); // system -> light
  await expect(toggle).toHaveAttribute("aria-label", /ライト/);
  await expect(html).not.toHaveClass(/dark/);

  await toggle.click(); // light -> dark
  await expect(toggle).toHaveAttribute("aria-label", /ダーク/);
  await expect(html).toHaveClass(/dark/);

  await toggle.click(); // dark -> system
  await expect(toggle).toHaveAttribute("aria-label", /システム/);
});

test("help page renders its sections", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "使い方", exact: true })).toBeVisible();
  await expect(page.getByText("GTOベースラインとAIのエクスプロイト提案の違い")).toBeVisible();
});

test("updates page renders the changelog", async ({ page }) => {
  await page.goto("/updates");
  await expect(page.getByRole("heading", { name: "お知らせ" })).toBeVisible();
});

test("history page prompts for login when signed out", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByText(/ログインが必要です/)).toBeVisible();
});

test("a shared-hand link for a nonexistent id shows the not-found state", async ({ page }) => {
  await page.goto("/shared/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText(/見つからないか、共有が解除されています/)).toBeVisible({ timeout: 15_000 });
});
