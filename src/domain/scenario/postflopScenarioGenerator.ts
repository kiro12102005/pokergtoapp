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

/** Postflop-only subset of Street - see PostflopScenario.street. */
export type PostflopStreet = Extract<Street, "flop" | "turn" | "river">;

const POSTFLOP_STREET_ORDER: PostflopStreet[] = ["flop", "turn", "river"];
const BOARD_SIZE_FOR_STREET: Record<PostflopStreet, number> = { flop: 3, turn: 4, river: 5 };

/** Weights for which street ends up being the actual decision point - flop most common, river
 *  least (mirrors how fewer hands run all the way to showdown-adjacent streets). */
const TARGET_STREET_WEIGHTS: [PostflopStreet, number][] = [
  ["flop", 0.5],
  ["turn", 0.3],
  ["river", 0.2],
];

/** Common flop/turn/river bet sizes, as % of the pot - a small fixed set (rather than a
 *  continuous roll) so the training feedback sees round, realistic numbers. */
const BET_SIZE_PERCENT_POT = [33, 50, 66, 100];

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
 *  single raise/call. Mutually exclusive with multiway (see MULTIWAY_RATE) - a 3-way 3-bet pot
 *  isn't generated, to keep the combinatorics (and the required stack depth) manageable. */
const THREE_BET_POT_RATE = 0.4;

/** Fraction of (non-3-bet) hands that bring a third player along preflop - see
 *  generateRandomPostflopScenario's "light multiway" section. */
const MULTIWAY_RATE = 0.25;

export interface PostflopScenario {
  street: PostflopStreet;
  heroPosition: Position;
  /** The one active opponent hero actually plays the postflop street(s) against - see
   *  gtoBaseline.ts's heads-up range-vs-range assumption. In a multiway hand this is whichever
   *  of the two non-hero preflop participants didn't fold the flop (see isMultiway). */
  villainPosition: Position;
  effectiveStackBB: number;
  startingPotBB: number;
  /** Preflop (folds + raise/call, raise/3-bet/call, or - multiway - raise/call/call), any
   *  street(s) before `street` (each fully resolved as either checked-through or bet-and-called -
   *  see generateRandomPostflopScenario), and finally `street` itself: either empty
   *  (facingBet=false, hero decides check/bet) or villain's bet (facingBet=true, hero decides
   *  fold/call/raise). In a multiway hand, the flop entry also includes the third player's fold.
   *  See describePreflopPot() for a human-readable summary of the preflop portion. */
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>;
  /** Sized to `street` (3/4/5 cards for flop/turn/river). */
  board: Card[];
  heroCards: [Card, Card];
  /** Whether villain has already bet `street` (hero facing call/raise/fold) or nobody has acted
   *  this street yet (hero facing check/bet, including a possible c-bet or donk-bet spot). */
  facingBet: boolean;
}

export interface PreflopPotSummary {
  isThreeBetPot: boolean;
  /** Whether a third player called along preflop (and folded the flop - see PostflopScenario's
   *  actionsByStreet doc) rather than this being a two-way pot from the start. */
  isMultiway: boolean;
  /** The position whose open-raise started the pot (and, in a 3-bet pot, who called the 3-bet -
   *  they never re-raise again in v1's single-3-bet-then-call model). */
  openerPosition: Position;
  /** The first position (in preflop action order) to respond to the open - the 3-bettor in a
   *  3-bet pot, or the (first, in a multiway pot) caller otherwise. Not necessarily
   *  PostflopScenario.villainPosition in a multiway pot - see isMultiway. */
  responderPosition: Position;
}

/**
 * Reads a generated hand's preflop action list back into "who opened, who responded, was it a
 * 3-bet or multiway pot" - shared by the UI (to label the pot for the user, which is exactly the
 * ambiguity this function's addition fixes - see PostflopTrainPanel.tsx) and tests. Assumes the
 * shape generateRandomPostflopScenario() actually produces (fold* + raise + one of: [call],
 * [raise, call], or [call, call]) rather than handling arbitrary action histories - a 3-bet pot
 * and a multiway (call, call) pot both have 3 non-fold preflop actions, so they're told apart by
 * whether the second one is a raise or a call.
 */
export function describePreflopPot(preflopActions: ActionEvent[]): PreflopPotSummary {
  const nonFolds = preflopActions.filter((e) => e.action !== "fold");
  return {
    isThreeBetPot: nonFolds.length === 3 && nonFolds[1].action === "raise",
    isMultiway: nonFolds.length === 3 && nonFolds[1].action === "call",
    openerPosition: nonFolds[0].position,
    responderPosition: nonFolds[1].position,
  };
}

function pickRandom<T>(items: T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)];
}

function pickWeighted<T>(weighted: [T, number][], random: RandomSource): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let target = random() * total;
  for (const [item, weight] of weighted) {
    target -= weight;
    if (target <= 0) return item;
  }
  return weighted[weighted.length - 1][0];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
 * Generates a random postflop practice hand: hero + one active villain (everyone else folded
 * preflop) reach a decision point on the flop, turn, or river (see TARGET_STREET_WEIGHTS) - the
 * same "single representative opponent" reduction the rest of this app uses (see
 * scenarioGenerator.ts) - after either a single open-raise and call, an open-raise/3-bet/call
 * (see THREE_BET_POT_RATE), or - see MULTIWAY_RATE - a third player calling along preflop and
 * then folding the flop, so hero and villain still end up playing the rest of the hand heads-up
 * (this app's GTO baseline math is heads-up range-vs-range - see gtoBaseline.ts - so a third
 * player has to be gone before any postflop equity/pot-odds numbers are computed). Any street
 * strictly before the decision street is fully resolved as either checked through or
 * bet-and-called, so the decision street always inherits a coherent pot/board/history. On the
 * decision street itself, either nobody has bet yet (hero decides check/bet) or villain has bet a
 * round %-pot size (hero decides fold/call/raise). Feeding the result through gtoBaseline.ts and
 * buildAdvisorPrompt() works exactly as it does for a manually-entered analyze-page situation,
 * since this produces the same shape of data (see engine/history/handRecord.ts's HandRecordDraft
 * for the sibling shape used by the analyze page's own state).
 *
 * 4-bet pots aren't generated - a preflop 3-bet is always just called, never re-raised. Multiway
 * and 3-bet pots are mutually exclusive (see MULTIWAY_RATE), and true multiway *postflop* play
 * (more than one active villain on the decision street) isn't modeled - the third player is
 * always gone by the flop.
 */
export function generateRandomPostflopScenario(random: RandomSource = Math.random): PostflopScenario {
  const isThreeBetPot = random() < THREE_BET_POT_RATE;
  const isMultiway = !isThreeBetPot && random() < MULTIWAY_RATE;

  const seatCount = isMultiway ? 3 : 2;
  const seats = shuffle(PREFLOP_ACTION_ORDER, random).slice(0, seatCount) as Position[];
  const heroPosition = seats[Math.floor(random() * seatCount)];
  // Preflop action order among the participating seats (earliest position opens).
  const [opener, ...responders] = [...seats].sort((a, b) => positionIndex(a) - positionIndex(b));

  // In a multiway hand, hero and the eventual postflop villain are randomly assigned between the
  // opener/responders (whichever two aren't the third player who folds the flop); heads-up, it's
  // simply "whichever seat isn't hero".
  const nonHeroSeats = seats.filter((p) => p !== heroPosition);
  const [villainPosition, thirdPlayerPosition] = isMultiway
    ? random() < 0.5
      ? [nonHeroSeats[0], nonHeroSeats[1]]
      : [nonHeroSeats[1], nonHeroSeats[0]]
    : [nonHeroSeats[0], undefined];

  const startingPotBB = 0.5 + 1 + 6 * ANTE_TO_BB_RATIO;
  const preflopActions: ActionEvent[] = [
    ...PREFLOP_ACTION_ORDER.filter((p) => !seats.includes(p)).map((position): ActionEvent => ({ position, action: "fold" })),
    { position: opener, action: "raise", sizeBB: OPEN_RAISE_SIZE_BB },
    ...(isThreeBetPot
      ? [
          { position: responders[0], action: "raise" as const, sizeBB: THREE_BET_SIZE_BB },
          { position: opener, action: "call" as const },
        ]
      : responders.map((position): ActionEvent => ({ position, action: "call" }))),
  ];

  const stackBuckets = isThreeBetPot ? THREE_BET_POT_STACK_BUCKETS_BB : POSTFLOP_STACK_BUCKETS_BB;
  const effectiveStackBB = pickRandom(stackBuckets, random) * (0.8 + random() * 0.4);

  const targetStreet = pickWeighted(TARGET_STREET_WEIGHTS, random);
  const deck = shuffledDeck(random);
  const heroCards: [Card, Card] = [deck[0], deck[1]];
  const board = deck.slice(2, 2 + BOARD_SIZE_FOR_STREET[targetStreet]);

  const actionsByStreet: Partial<Record<Street, ActionEvent[]>> = { preflop: preflopActions };
  let facingBet = false;

  for (const street of POSTFLOP_STREET_ORDER) {
    const priorStreet: Street = street === "flop" ? "preflop" : POSTFLOP_STREET_ORDER[POSTFLOP_STREET_ORDER.indexOf(street) - 1];
    const potBeforeStreet = computeCurrentPot(startingPotBB, actionsByStreet, priorStreet);
    // The third player folds as soon as action reaches them on the flop - gone for every street
    // from here on, so this only ever applies once, right at the start of the flop's list.
    const thirdPlayerFold: ActionEvent[] = street === "flop" && thirdPlayerPosition ? [{ position: thirdPlayerPosition, action: "fold" }] : [];

    if (street === targetStreet) {
      facingBet = random() < 0.55;
      const decisionActions: ActionEvent[] = facingBet
        ? [{ position: villainPosition, action: "raise", sizeBB: round1(potBeforeStreet * (pickRandom(BET_SIZE_PERCENT_POT, random) / 100)) }]
        : [];
      actionsByStreet[street] = [...thirdPlayerFold, ...decisionActions];
      break;
    }

    // A street strictly before the decision point is always fully resolved (both remaining
    // players act) - either checked through for free, or villain bets and hero calls to see the
    // next card.
    const resolved: ActionEvent[] =
      random() < 0.5
        ? [
            { position: villainPosition, action: "check" },
            { position: heroPosition, action: "check" },
          ]
        : [
            { position: villainPosition, action: "raise", sizeBB: round1(potBeforeStreet * (pickRandom(BET_SIZE_PERCENT_POT, random) / 100)) },
            { position: heroPosition, action: "call" },
          ];
    actionsByStreet[street] = [...thirdPlayerFold, ...resolved];
  }

  return {
    street: targetStreet,
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
