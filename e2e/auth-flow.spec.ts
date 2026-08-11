import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Covers the one flow public-flows.spec.ts can't: save an analysis to history (requires a
 * logged-in session), turn sharing on, view the public /shared/[id] link, then delete the
 * record. This app only supports Supabase magic-link (OTP) sign-in - no password - so there's no
 * form field to fill in like a typical login test. Instead this spec uses the Supabase Admin API
 * to generate a real magic-link URL for a disposable test user and navigates to it directly,
 * exercising the exact same callback handling a real emailed link would (see authStore.ts) -
 * rather than adding a parallel test-only auth path.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (see e2e/README.md for where to get it and how to keep it
 * out of version control) - the whole spec is skipped when it's not set, so it's safe to leave
 * this file in place on a machine/CI run that doesn't have it.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("authenticated flow: save -> share -> delete", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "Requires NEXT_PUBLIC_SUPABASE_URL (already used by the app) and SUPABASE_SERVICE_ROLE_KEY " +
      "(Supabase dashboard -> Settings -> API -> service_role secret) to mint a disposable test " +
      "user's session. See e2e/README.md."
  );

  let testEmail: string;
  let userId: string | undefined;

  test.beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
    testEmail = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin.auth.admin.createUser({ email: testEmail, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  test.afterAll(async () => {
    // Deleting the auth user cascades to their hand_records (see supabase/schema.sql's
    // `on delete cascade`), so this also cleans up whatever the test saved.
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !userId) return;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await admin.auth.admin.deleteUser(userId);
  });

  test("save an analysis, share it, view the public link, then delete it", async ({ page, context }) => {
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
      options: { redirectTo: BASE_URL },
    });
    if (linkError) throw linkError;

    // Visiting the real magic-link URL is exactly what a user does from their inbox - this
    // exercises the app's actual auth callback handling (see authStore.ts's onAuthStateChange)
    // rather than a parallel test-only session-injection path.
    await page.goto(linkData.properties.action_link);
    await expect(page.getByText(`${testEmail} でログイン中`)).toBeVisible({ timeout: 15_000 });

    // Analyze: sample hand -> submit. No LLM API key is configured in this fresh browser
    // context, but the GTO block is computed client-side and doesn't need one - see
    // public-flows.spec.ts's identical assertion.
    await page.goto("/analyze");
    await page.getByRole("button", { name: "サンプルハンドを試す" }).click();
    await page.getByRole("button", { name: "分析する" }).click();
    await expect(page.getByText("計算値・チップEVベース")).toBeVisible({ timeout: 15_000 });

    // Save to history.
    await page.getByRole("button", { name: "履歴に保存" }).click();
    await expect(page.getByText("保存しました。")).toBeVisible({ timeout: 10_000 });

    // History: the just-saved record is the only one on this fresh test account - expand it,
    // turn sharing on, and grab the share link.
    await page.goto("/history");
    await page.getByRole("button", { name: /BTN.*100BB/ }).click();
    await page.getByLabel(/リンクを知っている人に共有する/).check();
    const shareUrlInput = page.locator('input[readonly]');
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain("/shared/");

    // The public link works in a brand-new, unauthenticated context - no cookies/session
    // carried over from `page`.
    const publicPage = await context.browser()!.newContext().then((c) => c.newPage());
    await publicPage.goto(shareUrl);
    await expect(publicPage.getByText("共有されたハンド")).toBeVisible({ timeout: 15_000 });
    await expect(publicPage.getByText("計算値・チップEVベース")).toBeVisible();
    await publicPage.close();

    // Delete the record (HandRecordCard's delete button triggers a native `confirm()`).
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByText(/まだ保存された記録がありません|条件に一致する記録が見つかりません/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
