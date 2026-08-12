import { Card, cardFromString } from "@/domain/cards/card";
import { boardSizeForStreet } from "@/domain/scenario/customSituation";
import { computeCurrentPot } from "@/domain/scenario/potCalculator";
import { ActionEvent, ActionType, Street } from "@/domain/scenario/scenarioState";
import { Position, SEAT_RING_ORDER } from "@/domain/table/seats";
import { PlayerStack } from "@/engine/advisor/types";
import { HandRecordSnapshot } from "@/engine/history/handRecord";

export class HandHistoryParseError extends Error {}

interface Seat {
  seatNumber: number;
  name: string;
  /** In whatever unit the hand history uses (dollars for cash, chips for tournament) - converted
   *  to BB via toBB() once the big blind amount is known. */
  stack: number;
}

const STREET_MARKERS: { street: Street; marker: RegExp }[] = [
  { street: "preflop", marker: /\*\*\* HOLE CARDS \*\*\*/ },
  { street: "flop", marker: /\*\*\* FLOP \*\*\*/ },
  { street: "turn", marker: /\*\*\* TURN \*\*\*/ },
  { street: "river", marker: /\*\*\* RIVER \*\*\*/ },
];
// Anything at or after this ends action parsing for the river section - summary/showdown lines
// ("PlayerX: shows [...]", "PlayerX collected $10 from pot", ...) don't match the action-verb
// regex below anyway, but cutting the text here keeps line-by-line parsing on just the hand
// itself rather than the pot-recap block.
const HAND_END_MARKER = /\*\*\* (SHOWDOWN|SUMMARY) \*\*\*/;

function parseSeats(text: string): Seat[] {
  const seats: Seat[] = [];
  const seatLine = /^Seat (\d+): (.+?) \(\$?([\d,]+(?:\.\d+)?) in chips\)/gm;
  let match: RegExpExecArray | null;
  while ((match = seatLine.exec(text))) {
    seats.push({
      seatNumber: Number(match[1]),
      name: match[2].trim(),
      stack: Number(match[3].replace(/,/g, "")),
    });
  }
  return seats.sort((a, b) => a.seatNumber - b.seatNumber);
}

/** Rotates the seat list so it starts at the button and wraps around the table in seat-number
 *  order, then zips it against SEAT_RING_ORDER (BTN, SB, BB, UTG, HJ, CO - the same physical
 *  seating order relative to the button that app's own domain model already encodes). */
function assignPositions(seats: Seat[], buttonSeatNumber: number): Map<string, Position> {
  const buttonIndex = seats.findIndex((s) => s.seatNumber === buttonSeatNumber);
  if (buttonIndex === -1) {
    throw new HandHistoryParseError("ボタンの席が見つかりませんでした。");
  }
  const ordered = [...seats.slice(buttonIndex), ...seats.slice(0, buttonIndex)];
  const positionByName = new Map<string, Position>();
  ordered.forEach((seat, i) => positionByName.set(seat.name, SEAT_RING_ORDER[i]));
  return positionByName;
}

function sectionsByStreet(text: string): Partial<Record<Street, string>> {
  const cutoff = text.search(HAND_END_MARKER);
  const body = cutoff === -1 ? text : text.slice(0, cutoff);

  const found = STREET_MARKERS.map(({ street, marker }) => ({ street, index: body.search(marker) })).filter(
    (m) => m.index !== -1
  );
  const sections: Partial<Record<Street, string>> = {};
  found.forEach((entry, i) => {
    const end = i + 1 < found.length ? found[i + 1].index : body.length;
    sections[entry.street] = body.slice(entry.index, end);
  });
  return sections;
}

const ACTION_LINE = /^(.+?): (folds|checks|calls|bets|raises)\b(.*)$/;

function parseActionLine(line: string, positionByName: Map<string, Position>): ActionEvent | null {
  const match = ACTION_LINE.exec(line.trim());
  if (!match) return null;
  const position = positionByName.get(match[1].trim());
  // Unrecognized name (chat lines, "Dealer:" notes, ...) - skip rather than fail the whole parse.
  if (!position) return null;

  const verb = match[2];
  const rest = match[3];
  const isAllIn = /and is all-in/.test(rest);

  let action: ActionType;
  let sizeBB: number | undefined;
  if (verb === "folds") action = "fold";
  else if (verb === "checks") action = "check";
  else if (verb === "calls") action = "call";
  else {
    // "bets $X" or "raises $X to $Y" - the raise-TO amount is what ActionEvent.sizeBB wants.
    // An explicit "and is all-in" on a bet/raise is this app's "shove" action; an all-in call
    // stays a plain call (see ActionEvent's doc - shove/raise share pot math, but only
    // raise/shove set the street's aggressor, and an all-in call is never the aggressor).
    action = isAllIn ? "shove" : "raise";
    const toMatch = /to \$?([\d,]+(?:\.\d+)?)/.exec(rest);
    const betMatch = /^ \$?([\d,]+(?:\.\d+)?)/.exec(rest);
    const amountStr = toMatch?.[1] ?? betMatch?.[1];
    if (!amountStr) return null;
    sizeBB = Number(amountStr.replace(/,/g, ""));
  }
  return { position, action, sizeBB };
}

function extractBoard(text: string): Card[] {
  const flop = /\*\*\* FLOP \*\*\* \[([^\]]+)\]/.exec(text);
  const turn = /\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/.exec(text);
  const river = /\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/.exec(text);
  const tokens = [...(flop?.[1].split(/\s+/) ?? []), turn?.[1], river?.[1]].filter((t): t is string => Boolean(t));
  try {
    return tokens.map((t) => cardFromString(t));
  } catch {
    throw new HandHistoryParseError("ボードのカード表記を読み取れませんでした。");
  }
}

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

/**
 * This app's analyze mode always frames a situation as "given this history, what should hero do
 * next" - the action list for the current street stops right before hero's own decision, not
 * after it (see ActionHistoryBuilder.tsx's doc comment and buildHandRecordSnapshot()'s
 * truncateActionsToStreet()). A full played-out hand has hero's decisions baked in, so this
 * finds hero's actual last decision point - the latest street hero has any action on - and cuts
 * that street's action list right before hero's first action there, dropping hero's action
 * itself and everything after it (on that street and any later streets). Also drops board cards
 * beyond that street, even if the hand history text deals further streets after hero folded.
 */
function truncateToHeroDecision(
  heroPosition: Position,
  actionsByStreet: Partial<Record<Street, ActionEvent[]>>,
  board: Card[]
): { street: Street; actionsByStreet: Partial<Record<Street, ActionEvent[]>>; board: Card[] } {
  const streetsWithHeroAction = STREET_ORDER.filter((s) =>
    (actionsByStreet[s] ?? []).some((e) => e.position === heroPosition)
  );
  const street = streetsWithHeroAction[streetsWithHeroAction.length - 1];
  if (!street) {
    throw new HandHistoryParseError(
      "このハンドではヒーローの意思決定シーンが見つかりませんでした(ヒーローの番が回ってくる前にハンドが終了しています)。"
    );
  }

  const truncated: Partial<Record<Street, ActionEvent[]>> = {};
  for (const s of STREET_ORDER) {
    if (s === street) {
      const events = actionsByStreet[s] ?? [];
      const heroIndex = events.findIndex((e) => e.position === heroPosition);
      truncated[s] = events.slice(0, heroIndex);
      break;
    }
    if (actionsByStreet[s]) truncated[s] = actionsByStreet[s];
  }
  return { street, actionsByStreet: truncated, board: board.slice(0, boardSizeForStreet(street)) };
}

/**
 * Parses a PokerStars-format hand history (the de facto standard most training/review tools also
 * export) into this app's HandRecordSnapshot shape, ready for analyzeStore.ts's
 * loadFromSnapshot() - lets a user paste a real hand instead of re-entering it via
 * ActionHistoryBuilder click by click. 6-max only, matching this app's fixed Position model
 * (UTG/HJ/CO/BTN/SB/BB) - a table with a different seat count throws rather than guessing a
 * mapping. Only trusts an explicit "and is all-in" marker for shoves; never infers an all-in from
 * remaining-stack math, since that's fragile across side pots.
 */
export function parseHandHistory(rawText: string): HandRecordSnapshot {
  const text = rawText.trim();
  if (!text) throw new HandHistoryParseError("ハンド履歴のテキストを貼り付けてください。");

  const seats = parseSeats(text);
  if (seats.length !== 6) {
    throw new HandHistoryParseError(`6人打ちのハンドのみ対応しています(検出した席数: ${seats.length})。`);
  }

  const buttonMatch = /Seat #(\d+) is the button/.exec(text);
  if (!buttonMatch) throw new HandHistoryParseError("ボタンの位置を読み取れませんでした。");
  const positionByName = assignPositions(seats, Number(buttonMatch[1]));

  const bigBlindMatch = /: posts big blind \$?([\d,]+(?:\.\d+)?)/.exec(text);
  if (!bigBlindMatch) throw new HandHistoryParseError("ビッグブラインドの額を読み取れませんでした。");
  const bigBlindAmount = Number(bigBlindMatch[1].replace(/,/g, ""));
  if (!bigBlindAmount) throw new HandHistoryParseError("ビッグブラインドの額が不正です。");
  const toBB = (amount: number) => Math.round((amount / bigBlindAmount) * 100) / 100;

  let anteTotalBB = 0;
  const anteLine = /: posts the ante \$?([\d,]+(?:\.\d+)?)/g;
  let anteMatch: RegExpExecArray | null;
  while ((anteMatch = anteLine.exec(text))) {
    anteTotalBB += toBB(Number(anteMatch[1].replace(/,/g, "")));
  }
  // 0.5 + 1 rather than the parsed SB amount, to match STANDARD_BLINDS in potCalculator.ts (the
  // engine always assumes an exact half-BB small blind for its own pot math).
  const startingPotBB = 0.5 + 1 + anteTotalBB;

  const dealtMatches = [...text.matchAll(/^Dealt to (.+?) \[([^\]]+)\]/gm)];
  const heroDeal = dealtMatches.find((m) => m[1].trim() === "Hero") ?? dealtMatches[0];
  if (!heroDeal) throw new HandHistoryParseError("ヒーローのハンドカード(Dealt to ...)が見つかりませんでした。");
  const heroPosition = positionByName.get(heroDeal[1].trim());
  if (!heroPosition) throw new HandHistoryParseError("ヒーローの座席を特定できませんでした。");
  const heroCardTokens = heroDeal[2].trim().split(/\s+/);
  if (heroCardTokens.length !== 2) throw new HandHistoryParseError("ヒーローのハンドカードを読み取れませんでした。");
  let heroCards: [Card, Card];
  try {
    heroCards = [cardFromString(heroCardTokens[0]), cardFromString(heroCardTokens[1])];
  } catch {
    throw new HandHistoryParseError("ヒーローのハンドカード表記を読み取れませんでした。");
  }

  const fullBoard = extractBoard(text);

  const sections = sectionsByStreet(text);
  const fullActionsByStreet: Partial<Record<Street, ActionEvent[]>> = {};
  for (const [streetName, section] of Object.entries(sections) as [Street, string][]) {
    const events = section
      .split("\n")
      .map((line) => parseActionLine(line, positionByName))
      .filter((e): e is ActionEvent => e !== null)
      // Convert dollar/chip amounts to BB now that toBB() is available.
      .map((e) => (e.sizeBB !== undefined ? { ...e, sizeBB: toBB(e.sizeBB) } : e));
    if (events.length > 0) fullActionsByStreet[streetName] = events;
  }

  const {
    street: resolvedStreet,
    actionsByStreet,
    board,
  } = truncateToHeroDecision(heroPosition, fullActionsByStreet, fullBoard);

  const heroName = heroDeal[1].trim();
  const otherPlayers: PlayerStack[] = seats
    .filter((s) => s.name !== heroName)
    .map((s) => ({ position: positionByName.get(s.name)!, stackBB: toBB(s.stack) }));
  const heroSeat = seats.find((s) => s.name === heroName);
  const heroStackBB = heroSeat ? toBB(heroSeat.stack) : 100;
  const effectiveStackBB = Math.min(heroStackBB, ...otherPlayers.map((p) => p.stackBB));

  const headerLine = text.split("\n", 1)[0] ?? "";
  const format = /Tournament/i.test(headerLine) ? "tournament" : "cash";

  const snapshot: HandRecordSnapshot = {
    format,
    cashRake: 0,
    street: resolvedStreet,
    heroPosition,
    effectiveStackBB,
    startingPotBB,
    potBB: 0, // placeholder, computed below
    board,
    heroCards,
    actionsByStreet,
    otherPlayers,
    villainRanges: {},
  };
  snapshot.potBB = computeCurrentPot(startingPotBB, actionsByStreet, resolvedStreet);
  return snapshot;
}
