import { describe, it, expect } from "vitest";
import { buildAdvisorPrompt, buildExternalPrompt } from "@/engine/advisor/promptBuilder";
import { AdvisorSituation } from "@/engine/advisor/types";
import { Card } from "@/domain/cards/card";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const baseSituation: AdvisorSituation = {
  format: "tournament",
  street: "flop",
  heroPosition: "BB",
  effectiveStackBB: 80,
  potBB: 6,
  board: [card(14, "s"), card(7, "h"), card(2, "d")],
  heroCards: [card(13, "s"), card(13, "h")],
  actionsByStreet: {
    preflop: [{ position: "BTN", action: "raise", sizeBB: 2.5 }, { position: "BB", action: "call" }],
    flop: [{ position: "BB", action: "check" }],
  },
};

describe("buildAdvisorPrompt", () => {
  it("includes street, position, stack, pot, board and hand in the user prompt", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).toContain("フロップ");
    expect(user).toContain("BB");
    expect(user).toContain("80BB");
    expect(user).toContain("6BB");
    expect(user).toContain("K");
  });

  it("includes every street's actions up to and including the current one", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).toContain("ベット/レイズ");
    expect(user).toContain("コール");
    expect(user).toContain("チェック");
  });

  it("does not include a later street's actions that haven't happened yet", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      street: "preflop",
      board: [],
    });
    // flop actions shouldn't leak into a preflop-street prompt
    expect(user).not.toContain("チェック");
  });

  it("shows a placeholder for a street with no actions yet", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, actionsByStreet: {} });
    expect(user).toContain("アクションなし");
  });

  it("omits the extra context line when not provided", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).not.toContain("補足情報");
  });

  it("includes extra context when provided", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, extraContext: "相手はタイト" });
    expect(user).toContain("相手はタイト");
  });

  it("labels the preflop street correctly with an empty board", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, street: "preflop", board: [] });
    expect(user).toContain("プリフロップ");
    expect(user).toContain("ボードなし");
  });

  it("returns a stable system prompt instructing structured JSON output", () => {
    const { system } = buildAdvisorPrompt(baseSituation);
    expect(system).toContain("JSON");
    expect(system).toContain("fold");
  });

  it("omits the ICM section when no other players are given", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).not.toContain("ICM状況");
  });

  it("includes hero's computed hand category once the board has 3+ cards", () => {
    const { user } = buildAdvisorPrompt(baseSituation); // KK on A72 -> one pair
    expect(user).toContain("ヒーローの現在の役");
    expect(user).toContain("ワンペア");
  });

  it("omits the hand-category line preflop (no board yet)", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, street: "preflop", board: [] });
    expect(user).not.toContain("ヒーローの現在の役");
  });

  it("correctly reports two pair (not a straight) for the reported AJTQ-board misread case", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      street: "turn",
      heroCards: [card(14, "s"), card(11, "h")], // A J
      board: [card(14, "c"), card(11, "d"), card(10, "s"), card(12, "h")], // A J T Q
    });
    expect(user).toContain("ツーペア");
    expect(user).not.toContain("ストレート");
  });

  it("includes an ICM section with real icmEquity-derived points when other players are given", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      otherPlayers: [
        { position: "BTN", stackBB: 40 },
        { position: "SB", stackBB: 10 },
      ],
    });
    expect(user).toContain("ICM状況");
    expect(user).toContain("残り3人");
    expect(user).toContain("BTN");
    expect(user).toContain("SB");
    expect(user).toContain("期待ポイント");
    // Short stack (SB, 10BB) should show a lower expected-points value than the big stack (BTN, 40BB).
    const icmLines = user.split("\n").filter((line) => line.includes("期待ポイント"));
    const sbLine = icmLines.find((line) => line.includes("SB:"))!;
    const btnLine = icmLines.find((line) => line.includes("BTN:"))!;
    const sbPoints = Number(sbLine.match(/期待ポイント ([\d.-]+)/)![1]);
    const btnPoints = Number(btnLine.match(/期待ポイント ([\d.-]+)/)![1]);
    expect(btnPoints).toBeGreaterThan(sbPoints);
  });

  it("omits the GTO baseline section when not provided", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    // The closing instruction always mentions "GTOベースライン" generically - check the
    // section header itself (with the computed-fact framing) is absent instead.
    expect(user).not.toContain("GTOベースライン(計算済み");
  });

  it("includes the GTO baseline numbers and a call/fold lean when provided", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      gtoBaseline: { requiredEquity: 0.33, heroEquity: 0.42, rangeDescription: "上位25%のレンジ" },
    });
    expect(user).toContain("GTOベースライン");
    expect(user).toContain("33.0%");
    expect(user).toContain("42.0%");
    expect(user).toContain("上位25%のレンジ");
    expect(user).toContain("コールが有利");
  });

  it("reports a fold lean when required equity exceeds hero's actual equity", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      gtoBaseline: { requiredEquity: 0.5, heroEquity: 0.3, rangeDescription: "上位25%のレンジ" },
    });
    expect(user).toContain("フォールドが有利");
  });

  it("instructs the model to treat the GTO baseline as the exploit-adjustment starting point", () => {
    const { system } = buildAdvisorPrompt(baseSituation);
    expect(system).toContain("GTOベースライン");
    expect(system).toContain("エクスプロイト");
  });

  it("tells the model to use ベット wording when nobody has bet this street yet", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, facingBet: false });
    expect(user).toContain("まだ誰もベットしていない");
    expect(user).toContain("「ベット」の語を使うこと");
  });

  it("tells the model to use レイズ wording when hero is facing a bet", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, facingBet: true });
    expect(user).toContain("相手が既にベットしており");
    expect(user).toContain("「レイズ」の語を使うこと");
  });

  it("omits the facing-bet line when facingBet isn't provided", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).not.toContain("このストリートの状況");
  });

  it("omits the facing-bet line preflop even if facingBet were somehow set", () => {
    const { user } = buildAdvisorPrompt({ ...baseSituation, street: "preflop", board: [], facingBet: true });
    expect(user).not.toContain("このストリートの状況");
  });

  it("instructs the model on the raise/bet terminology distinction and structured sizing", () => {
    const { system } = buildAdvisorPrompt(baseSituation);
    expect(system).toContain("ドンクベット");
    expect(system).toContain("sizePercentPot");
  });

  it("includes hero's actual action when provided", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      actualAction: { position: "BB", action: "call" },
    });
    expect(user).toContain("ヒーローが実際に取った行動");
    expect(user).toContain("BB");
    expect(user).toContain("コール");
  });

  it("omits the actual-action line when not provided", () => {
    const { user } = buildAdvisorPrompt(baseSituation);
    expect(user).not.toContain("ヒーローが実際に取った行動");
  });

  it("instructs the model to explicitly address whether hero's actual action matches the recommendation", () => {
    const { system } = buildAdvisorPrompt(baseSituation);
    expect(system).toContain("ヒーローが実際に取った行動");
    expect(system).toContain("推奨");
  });

  it("uses a cash-framed system prompt that drops club-match framing for format: cash", () => {
    const { system } = buildAdvisorPrompt({ ...baseSituation, format: "cash" });
    expect(system).toContain("リングキャッシュ");
    expect(system).not.toContain("クラブマッチ");
    // Cash still explicitly states it has no ICM (rather than silently omitting the concept) -
    // only the "weigh ICM/finish-points" instruction that applies to tournament is dropped.
    expect(system).toContain("チップEV");
    expect(system).not.toContain("バブル要因やペイジャンプ");
  });

  it("omits the ICM section for a cash situation even if otherPlayers were somehow set", () => {
    const { user } = buildAdvisorPrompt({
      ...baseSituation,
      format: "cash",
      otherPlayers: [{ position: "BTN", stackBB: 40 }],
    });
    expect(user).not.toContain("ICM状況");
  });
});

describe("buildExternalPrompt", () => {
  it("includes the same play-relevant facts as the internal user prompt", () => {
    const external = buildExternalPrompt(baseSituation);
    expect(external).toContain("フロップ");
    expect(external).toContain("80BB");
    expect(external).toContain("6BB");
    expect(external).toContain("K");
    expect(external).toContain("ベット/レイズ");
  });

  it("does not include this app's internal persona/JSON-output instructions", () => {
    const external = buildExternalPrompt(baseSituation);
    expect(external).not.toContain("エクスプロイト戦略アドバイザー");
    expect(external).not.toContain("JSON");
    expect(external).not.toContain("sizePercentPot");
    expect(external).not.toContain("frequencies");
  });

  it("closes with a plain-language question instead of a JSON directive", () => {
    const external = buildExternalPrompt(baseSituation);
    expect(external).toContain("おすすめのアクションとその理由を教えてください");
  });

  it("still includes ICM and GTO baseline sections when provided (chip/play-relevant data)", () => {
    const external = buildExternalPrompt({
      ...baseSituation,
      otherPlayers: [{ position: "BTN", stackBB: 40 }],
      gtoBaseline: { requiredEquity: 0.33, heroEquity: 0.42, rangeDescription: "上位25%のレンジ" },
    });
    expect(external).toContain("ICM状況");
    expect(external).toContain("GTOベースライン");
  });
});
