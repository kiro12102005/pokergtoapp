import { describe, it, expect } from "vitest";
import { friendlyClaudeError } from "@/lib/claude/errorMessage";

describe("friendlyClaudeError", () => {
  it("recognizes a rate-limit error by status code", () => {
    const msg = friendlyClaudeError({ status: 429, message: "rate_limit_error" });
    expect(msg).toContain("利用上限(レート制限)に達しました");
  });

  it("recognizes an invalid API key error by status code", () => {
    const msg = friendlyClaudeError({ status: 401, message: "authentication_error" });
    expect(msg).toContain("APIキーが無効なようです");
  });

  it("recognizes a temporary server-side outage by status code", () => {
    const msg = friendlyClaudeError({ status: 529, message: "overloaded_error" });
    expect(msg).toContain("一時的に利用できないようです");
  });

  it("recognizes a timeout by message text", () => {
    const msg = friendlyClaudeError(new Error("Request aborted due to timeout"));
    expect(msg).toContain("タイムアウトしました");
  });

  it("falls back to a generic message while preserving the original text", () => {
    const msg = friendlyClaudeError(new Error("some unrecognized backend error"));
    expect(msg).toContain("リクエストに失敗しました");
    expect(msg).toContain("some unrecognized backend error");
  });

  it("handles a non-Error thrown value", () => {
    const msg = friendlyClaudeError("plain string failure");
    expect(msg).toContain("plain string failure");
  });
});
