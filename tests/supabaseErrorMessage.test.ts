import { describe, it, expect } from "vitest";
import { friendlySupabaseError } from "@/lib/supabase/errorMessage";

describe("friendlySupabaseError", () => {
  it("recognizes a schema-cache/table-not-found error", () => {
    const msg = friendlySupabaseError({
      message: "Could not find the table 'public.hand_records' in the schema cache",
    });
    expect(msg).toContain("テーブルが見つかりませんでした");
    expect(msg).toContain("schema.sql");
  });

  it("recognizes a network failure", () => {
    const msg = friendlySupabaseError({ message: "Failed to fetch" });
    expect(msg).toContain("ネットワークに接続できませんでした");
  });

  it("recognizes an RLS/permission error", () => {
    const msg = friendlySupabaseError({ message: "new row violates row-level security policy" });
    expect(msg).toContain("権限エラー");
  });

  it("recognizes an expired session", () => {
    const msg = friendlySupabaseError({ message: "JWT expired" });
    expect(msg).toContain("セッションの有効期限");
  });

  it("recognizes an invalid email", () => {
    const msg = friendlySupabaseError({ message: "Unable to validate email address: invalid format" });
    expect(msg).toContain("メールアドレスの形式");
  });

  it("recognizes a rate limit", () => {
    const msg = friendlySupabaseError({
      message: "For security purposes, you can only request this after 32 seconds",
    });
    expect(msg).toContain("リクエストが多すぎます");
  });

  it("falls back to a generic message while preserving the original text", () => {
    const msg = friendlySupabaseError({ message: "some unrecognized backend error" });
    expect(msg).toContain("エラーが発生しました");
    expect(msg).toContain("some unrecognized backend error");
  });
});
