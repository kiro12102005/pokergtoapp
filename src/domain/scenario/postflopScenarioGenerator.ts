import { Card } from "@/domain/cards/card";
import { RandomSource, shuffledDeck } from "@/domain/cards/deck";
import { PREFLOP_ACTION_ORDER, Position, positionIndex } from "@/domain/table/seats";
import {
  ANTE_TO_BB_RATIO,
  OPEN_RAISE_SIZE_BB,
  STACK_DEPTH_BUCKETS_BB,
  THREE_BET_SIZE_MULTIPLIER_OOP,
} from "@/engine/solver/abstraction";
import { computeCurrentPot } from "./potCalculator";
import { ActionEvent, Street } from "./scenarioState";

/** Common flop c-bet/donk-bet sizes, as % of the pot - a small fixed set (rather than a
 *  continuous roll) so the training feedback sees round, realistic numbers. */
const FLOP_BET_SIZE_PERCENT_POT = [33, 50, 66, 100];

/** Only deep enough stacks are worth practicing single-raised-pot postflop play at - shallower
 *  depths collapse toward shove-or-fold before the flop even matters (see abstraction.ts's
 *  SHOVE_ONLY_THRESHOLD_BB). */
const POSTFLOP_STACK_BUCKETS_BB = STACK_DEPTH_BUCKETS_BB.filter((bb) => bb >= 25);

/** 3-bet pots need deeper stacks to leave a meaningful (non-trivially-shove) postflop SPR after
 *  ~4x the open-raise size is already committed preflop - see generateRandomPostflopScenario. */
const THREE_BET_POT_STACK_BUCKETS_BB = STACK_DEPTH_BUCKETS_BB.filter((bb) => bb >= 60);

/** Same sizing convention scenarioGenerator.ts's preflop trainer already uses for its vs3bet
 *  node - always the OOP multiplier, regardless of the 3-bettor's actual position (see
 *  THREE_BET_SIZE_MULTIPLIER_IP's doc comment in abstraction.ts - reserved but unused so far). */
const THREE_BET_SIZE_BB = OPEN_RAISE_SIZE_BB * THREE_BET_SIZE_MULTIPLIER_OOP;

/** Fraction of generated hands that go through a preflop 3-bet (raise/3-bet/call) rather than a
 *  single raise/call. */
const THREE_BET_POT_RATE = 0.4;

export interface PostflopScenario {
  /** Flop-only for v1 - see postflopScenarioGenerator.ts's module doc. */
  street: Extract<Street, "flop">;
  heroPosition: Position;
  villainPosition: Position;
  effectiveStackBB: number;
  startingPotBB: number;
  /** Preflop (folds + either raise/call or raise/3-bet/call) plus, when facingBet, the villain's
   *  flop bet - see describePreflopPot() for a human-readable summary of this. */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  board: [Card, Card, Card];
  heroCards: [Card, Card];
  /** Whether villain has already bet the flop (hero facing call/raise/fold) or nobody has acted
   *  this street yet (hero facing check/bet, including a possible c-bet or donk-bet spot). */
  facingBet: boolean;
}

export interface PreflopPotSummary {
  isThreeBetPot: boolean;
  /** The position whose open-raise started the pot (and, in a 3-bet pot, who called the 3-bet -
   *  they never re-raise again in v1's single-3-bet-then-call model). */
  openerPosition: Position;
  /** The position who responded - either by flatting the open (single-raised pot) or by
   *  3-betting it (3-bet pot). */
  responderPosition: Position;
}

/**
 * Reads a generated hand's preflop action list back into "who opened, who responded, was it
 * 3-bet" - shared by the UI (to label the pot for the user, which is exactly the ambiguity this
 * function's addition fixes - see PostflopTrainPanel.tsx) and tests. Assumes the shape
 * generateRandomPostflopScenario() actually produces (fold* + raise + [raise +] call) rather than
 * handling arbitrary action histories.
 */
export function describePreflopPot(preflopActions: ActionEvent[]): PreflopPotSummary {
  const nonFolds = preflopActions.filter((e) => e.action !== "fold");
  return {
    isThreeBetPot: nonFolds.length >= 3,
    openerPosition: nonFolds[0].position,
    responderPosition: nonFolds[1].position,
  };
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
 * folded preflop) reach a heads-up flop - the same "single representative opponent" reduction
 * the rest of this app uses (see scenarioGenerator.ts) - after either a single open-raise and
 * call, or (see THREE_BET_POT_RATE) an open-raise, a 3-bet, and a call. Then either nobody has
 * bet the flop yet (hero decides check/bet) or villain has bet a round %-pot size (hero decides
 * fold/call/raise). Feeding the result through gtoBaseline.ts and buildAdvisorPrompt() works
 * exactly as it does for a manually-entered analyze-page situation, since this produces the same
 * shape of data (see engine/history/handRecord.ts's HandRecordDraft for the sibling shape used by
 * the analyze page's own state).
 *
 * Turn/river aren't generated yet (v1 scope) - only flop decisions. 4-bet pots aren't generated
 * either - a 3-bet is always just called, never re-raised.
 */
export function generateRandomPostflopScenario(random: RandomSource = Math.random): PostflopScenario {
  const [heroPosition, villainPosition] = shuffle(PREFLOP_ACTION_ORDER, random).slice(0, 2) as [Position, Position];
  const [opener, responder] =
    positionIndex(heroPosition) < positionIndex(villainPosition)
      ? [heroPosition, villainPosition]
      : [villainPosition, heroPosition];

  const isThreeBetPot = random() < THREE_BET_POT_RATE;

  const startingPotBB = 0.5 + 1 + 6 * ANTE_TO_BB_RATIO;
  const preflopActions: ActionEvent[] = [
    ...PREFLOP_ACTION_ORDER.filter((p) => p !== heroPosition && p !== villainPosition).map(
      (position): ActionEvent => ({ position, action: "fold" })
    ),
    { position: opener, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB },
    ...(isThreeBetPot
      ? [
          { position: responder, action: "raise" as const, sizeBB: THREE_BET_SIZE_BB },
          { position: opener, action: "call" as const },
        ]
      : [{ position: responder, action: "call" as const }]),
  ];
  const potEnteringFlop = computeCurrentPot(startingPotBB, { preflop: preflopActions }, "preflop");

  const stackBuckets = isThreeBetPot ? THREE_BET_POT_STACK_BUCKETS_BB : POSTFLOP_STACK_BUCKETS_BB;
  const effectiveStackBB = pickRandom(stackBuckets, random) * (0.8 + random() * 0.4);

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
