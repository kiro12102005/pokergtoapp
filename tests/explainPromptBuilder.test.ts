import { describe, it, expect } from "vitest";
import { buildExplainPrompt } from "@/engine/advisor/explainPromptBuilder";
import { AdvisorSituation } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const baseSituation: AdvisorSituation = {
  street: "preflop",
  heroPosition: "BTN",
  effectiveStackBB: 100,
  potBB: 1.5,
  board: [],
  heroCards: [card(14, "s"), card(13, "h")],
  actionsByStreet: {
    preflop: [
      { position: "UTG", action: "fold" },
      { position: "HJ", action: "fold" },
      { position: "CO", action: "fold" },
    ],
  },
};

describe("buildExplainPrompt", () => {
  it("includes the situation facts and the given frequencies", () => {
    const { user } = buildExplainPrompt(baseSituation, { raise: 0.8, fold: 0.2 });
    expect(user).toContain("BTN");
    expect(user).toContain("100BB");
    expect(user).toContain("ベット/レイズ 80%");
    expect(user).toContain("フォールド 20%");
  });

  it("omits zero/undefined-frequency actions from the formatted list", () => {
    const { user } = buildExplainPrompt(baseSituation, { raise: 1, call: 0 });
    expect(user).toContain("ベット/レイズ 100%");
    expect(user).not.toContain("コール");
  });

  it("includes hero's actual action when provided", () => {
    const { user } = buildExplainPrompt({ ...baseSituation, actualAction: { position: "BTN", action: "call" } }, { raise: 1 });
    expect(user).toContain("ヒーローが実際に取った行動");
  });

  it("instructs the model to treat the frequencies as fixed, not to be recomputed", () => {
    const { system } = buildExplainPrompt(baseSituation, { raise: 1 });
    expect(system).toContain("再計算");
  });

  it("instructs the model to address hero's actual action when given", () => {
    const { system } = buildExplainPrompt(baseSituation, { raise: 1 });
    expect(system).toContain("ヒーローが実際に取った行動");
  });
});
