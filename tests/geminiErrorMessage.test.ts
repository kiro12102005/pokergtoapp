import { describe, it, expect } from "vitest";
import { friendlyGeminiError } from "@/lib/gemini/errorMessage";

describe("friendlyGeminiError", () => {
  it("recognizes a rate-limit/quota error", () => {
    const msg = friendlyGeminiError(new Error("429 Too Many Requests: RESOURCE_EXHAUSTED"));
    expect(msg).toContain("利用上限(レート制限)に達しました");
  });

  it("recognizes an invalid API key error", () => {
    const msg = friendlyGeminiError(new Error("API key not valid. Please pass a valid API key."));
    expect(msg).toContain("APIキーが無効なようです");
  });

  it("recognizes a temporary server-side outage", () => {
    const msg = friendlyGeminiError(new Error("503 UNAVAILABLE: The model is overloaded"));
    expect(msg).toContain("一時的に利用できないようです");
  });

  it("falls back to a generic message while preserving the original text", () => {
    const msg = friendlyGeminiError(new Error("some unrecognized backend error"));
    expect(msg).toContain("リクエストに失敗しました");
    expect(msg).toContain("some unrecognized backend error");
  });

  it("handles a non-Error thrown value", () => {
    const msg = friendlyGeminiError("plain string failure");
    expect(msg).toContain("plain string failure");
  });
});
