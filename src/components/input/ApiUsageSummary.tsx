"use client";

import { useApiKeyStore } from "@/state/apiKeyStore";
import { useUsageStore } from "@/state/usageStore";
import { estimateCostUsd, isPriceExact } from "@/engine/advisor/usageTracking";

function formatUsd(amount: number): string {
  return amount < 0.01 ? "$0.01未満" : `約$${amount.toFixed(2)}`;
}

/**
 * Shows how much of the signed-in-user's own API key this app has used so far - not billing data
 * from the provider, just a client-side tally of what this app itself sent (see usageStore.ts).
 * Renders nothing until at least one call has been made, so it doesn't clutter the settings panel
 * for a user who hasn't analyzed anything yet.
 */
export function ApiUsageSummary() {
  const provider = useApiKeyStore((s) => s.provider);
  const usage = useUsageStore((s) => s[provider]);
  const reset = useUsageStore((s) => s.reset);

  if (usage.calls === 0) return null;

  const cost = estimateCostUsd(provider, usage.inputTokens, usage.outputTokens);
  const exact = isPriceExact(provider);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <span>
        このブラウザでのAPI利用量: {usage.calls}回 / 入力{usage.inputTokens.toLocaleString()}トークン / 出力
        {usage.outputTokens.toLocaleString()}トークン / {exact ? "" : "目安"}
        {formatUsd(cost)}
      </span>
      <button type="button" onClick={reset} className="underline hover:no-underline">
        リセット
      </button>
    </div>
  );
}
