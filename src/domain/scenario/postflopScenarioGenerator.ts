import { Card } from "@/domain/cards/card";
import { RandomSource, shuffledDeck } from "@/domain/cards/deck";
import { PREFLOP_ACTION_ORDER, Position, positionIndex } from "@/domain/table/seats";
import { ANTE_TO_BB_RATIO, OPEN_RAISE_SIZE_BB, STACK_DEPTH_BUCKETS_BB } from "@/engine/solver/abstraction";
import { computeCurrentPot } from "./potCalculator";
import { ActionEvent, Street } from "./scenarioState";

/** Common flop c-bet/donk-bet sizes, as % of the pot - a small fixed set (rather than a
 *  continuous roll) so the training feedback sees round, realistic numbers. */
const FLOP_BET_SIZE_PERCENT_POT = [33, 50, 66, 100];

/** Only deep enough stacks are worth practicing postflop play at - shallower depths collapse
 *  toward shove-or-fold before the flop even matters (see abstraction.ts's SHOVE_ONLY_THRESHOLD_BB). */
const POSTFLOP_STACK_BUCKETS_BB = STACK_DEPTH_BUCKETS_BB.filter((bb) => bb >= 25);

export interface PostflopScenario {
  /** Flop-only for v1 - see postflopScenarioGenerator.ts's module doc. */
  street: Extract<Street, "flop">;
  heroPosition: Position;
  villainPosition: Position;
  effectiveStackBB: number;
  startingPotBB: number;
  /** Preflop (fold/fold/.../open-raise/call) plus, when facingBet, the villain's flop bet. */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  board: [Card, Card, Card];
  heroCards: [Card, Card];
  /** Whether villain has already bet the flop (hero facing call/raise/fold) or nobody has acted
   *  this street yet (hero facing check/bet, including a possible c-bet or donk-bet spot). */
  facingBet: boolean;
}

function pickRandom<T>(items: T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)];
}

/** Fisher-Yates shuffle, reused here (rather than importing shuffledDeck's card-specific one)
 *  since it needs to work over Position values too. */
function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a random flop-street practice hand: two players (hero + one villain, everyone else
 * folded preflop) reach a heads-up flop after a single open-raise and call - the same "single
 * representative opponent" reduction the rest of this app uses (see scenarioGenerator.ts) -
 * then either nobody has bet the flop yet (hero decides check/bet) or villain has bet a round
 * %-pot size (hero decides fold/call/raise). Feeding the result through gtoBaseline.ts and
 * buildAdvisorPrompt() works exactly as it does for a manually-entered analyze-page situation,
 * since this produces the same shape of data (see engine/history/handRecord.ts's HandRecordDraft
 * for the sibling shape used by the analyze page's own state).
 *
 * Turn/river aren't generated yet (v1 scope) - only flop decisions.
 */
export function generateRandomPostflopScenario(random: RandomSource = Math.random): PostflopScenario {
  const [heroPosition, villainPosition] = shuffle(PREFLOP_ACTION_ORDER, random).slice(0, 2) as [Position, Position];
  const [opener, caller] =
    positionIndex(heroPosition) < positionIndex(villainPosition)
      ? [heroPosition, villainPosition]
      : [villainPosition, heroPosition];

  const startingPotBB = 0.5 + 1 + 6 * ANTE_TO_BB_RATIO;
  const preflopActions: ActionEvent[] = [
    ...PREFLOP_ACTION_ORDER.filter((p) => p !== heroPosition && p !== villainPosition).map(
      (position): ActionEvent => ({ position, action: "fold" })
    ),
    { position: opener, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB },
    { position: caller, action: "call" },
  ];
  const potEnteringFlop = computeCurrentPot(startingPotBB, { preflop: preflopActions }, "preflop");

  const effectiveStackBB = pickRandom(POSTFLOP_STACK_BUCKETS_BB, random) * (0.8 + random() * 0.4);

  const [c1, c2, b1, b2, b3] = shuffledDeck(random);
  const heroCards: [Card, Card] = [c1, c2];
  const board: [Card, Card, Card] = [b1, b2, b3];

  const facingBet = random() < 0.55;
  const actionsByStreet: Partial<Record<Street, ActionEvent[]>> = { preflop: preflopActions };
  if (facingBet) {
    const betPercent = pickRandom(FLOP_BET_SIZE_PERCENT_POT, random);
    const betSizeBB = Math.round(potEnteringFlop * (betPercent / 100) * 10) / 10;
    actionsByStreet.flop = [{ position: villainPosition, action: "raise", sizeBB: betSizeBB }];
  } else {
    actionsByStreet.flop = [];
  }

  return {
    street: "flop",
    heroPosition,
    villainPosition,
    effectiveStackBB,
    startingPotBB,
    actionsByStreet,
    board,
    heroCards,
    facingBet,
  };
}
