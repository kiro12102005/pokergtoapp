import { describe, it, expect } from "vitest";
import { actionHistoryKeyFor } from "@/domain/scenario/actionHistoryKey";

describe("actionHistoryKeyFor", () => {
  it("returns rfi for an empty history", () => {
    expect(actionHistoryKeyFor([])).toBe("rfi");
  });

  it("returns vsOpen after a single raise", () => {
    expect(actionHistoryKeyFor([{ position: "UTG", action: "raise", sizeBB: 2.5 }])).toBe("vsOpen");
  });

  it("returns vs3bet after two raises", () => {
    expect(
      actionHistoryKeyFor([
        { position: "UTG", action: "raise", sizeBB: 2.5 },
        { position: "BTN", action: "raise", sizeBB: 10 },
      ])
    ).toBe("vs3bet");
  });

  it("returns vs4bet after three or more raises/shoves", () => {
    expect(
      actionHistoryKeyFor([
        { position: "UTG", action: "raise", sizeBB: 2.5 },
        { position: "BTN", action: "raise", sizeBB: 10 },
        { position: "UTG", action: "shove", sizeBB: 100 },
      ])
    ).toBe("vs4bet");
  });

  it("ignores fold/call/check actions when counting raises", () => {
    expect(
      actionHistoryKeyFor([
        { position: "UTG", action: "fold" },
        { position: "HJ", action: "call" },
      ])
    ).toBe("rfi");
  });
});
