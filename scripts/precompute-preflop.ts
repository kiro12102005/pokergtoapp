/**
 * Offline precompute step for Phase 1's preflop solver. Run via `npm run precompute:preflop`.
 *
 * Two stages:
 *  1. Build (or load the cached) 169x169 canonical-hand equity matrix via Monte Carlo. This is
 *     format-independent (pure hand-vs-hand equity, no ICM/ante) so it's built once and reused
 *     for every (format, stack-depth bucket, position) situation below.
 *  2. For every (format, position, stack-depth bucket) situation, solve either the push/fold
 *     Nash (shove-only depths) or the deep-stack iterated-best-response tree (deeper depths),
 *     and write the resulting strategies to src/data/solverOutput/preflop.json.
 *
 * Solves both game formats (see domain/table/gameFormat.ts): "tournament" (ICM, against
 * CLUB_MATCH_POINTS_VECTOR, with the club-match ante) and "cash" (pure chip EV - a player's
 * utility is just their expected stack, so no ICM computation at all - and no ante), the latter
 * solved separately at each of the three standard rake tiers (0%/5%/10%, see
 * CASH_RAKE_OPTIONS - rake only ever applies to cash, and only to contested-pot terminals, see
 * gameTree.ts). Both formats use the exact same solver code (pushFoldSolver.ts / cfrSolver.ts);
 * only the injected `evaluateStacks` function and the ante/rake/stack-depth-bucket parameters
 * differ - see gameTree.ts's `StackEvaluator` doc.
 *
 * Both solvers use a "symmetric stack" table (every seat at the bucket's BB depth) for this
 * production table - see pushFoldSolver.ts / cfrSolver.ts for the full generic API, which
 * also accepts arbitrary (asymmetric) stack distributions, used by the ICM-sensitivity test.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PREFLOP_ACTION_ORDER, Position, positionsAfter } from "../src/domain/table/seats";
import { CASH_RAKE_OPTIONS, CashRakePercent, GameFormat } from "../src/domain/table/gameFormat";
import { ALL_HANDS } from "../src/domain/cards/handNotation";
import { seededRandom } from "../src/domain/cards/deck";
import { StrategyMix } from "../src/domain/scenario/scenarioState";
import { buildEquityMatrix, EquityMatrix } from "../src/engine/equity/equityMatrix";
import { clearIcmCache, icmEquity } from "../src/engine/icm/icm";
import { CLUB_MATCH_POINTS_VECTOR } from "../src/engine/icm/pointsVector";
import {
  OPEN_RAISE_SIZE_BB,
  THREE_BET_SIZE_MULTIPLIER_OOP,
  anteToBBRatioFor,
  isShoveOnlyDepth,
  situationKey,
  stackDepthBucketsFor,
} from "../src/engine/solver/abstraction";
import { solvePushFoldUnopened } from "../src/engine/solver/pushFoldSolver";
import { solveDeepStackPosition } from "../src/engine/solver/cfrSolver";
import { StackEvaluator, TableStacksBB } from "../src/engine/solver/gameTree";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EQUITY_CACHE_PATH = path.join(__dirname, "../src/data/equity/preflopEquity169.json");
const SOLVER_OUTPUT_PATH = path.join(__dirname, "../src/data/solverOutput/preflop.json");

const OPEN_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB"];
const GAME_FORMATS: GameFormat[] = ["tournament", "cash"];

const SB_AMOUNT_BB = 0.5;
const BB_AMOUNT_BB = 1;

function deadMoneyPotBB(format: GameFormat): number {
  return SB_AMOUNT_BB + BB_AMOUNT_BB + 6 * anteToBBRatioFor(format);
}

/** Cash's evaluator is the identity function - in a chip-EV game a player's utility is just
 *  their own expected stack, so no ICM computation (not even against a linear payout vector) is
 *  needed at all. Tournament keeps the existing ICM-against-club-match-points behavior. */
function evaluateStacksFor(format: GameFormat): StackEvaluator {
  return format === "cash" ? (stacks) => stacks : (stacks) => icmEquity(stacks, CLUB_MATCH_POINTS_VECTOR);
}

/**
 * Builds a table where every seat starts at `stackBB` and then has its own blind/ante
 * deducted, so the dead money handed to whoever wins the pot is actually sourced from
 * players' stacks (conservation of chips) rather than materializing on top of them.
 */
function buildSymmetricTable(
  heroPosition: Position,
  villainPosition: Position,
  stackBB: number,
  format: GameFormat
): TableStacksBB {
  const ante = anteToBBRatioFor(format);
  const stacksBB = PREFLOP_ACTION_ORDER.map((position) => {
    const blind = position === "SB" ? SB_AMOUNT_BB : position === "BB" ? BB_AMOUNT_BB : 0;
    return stackBB - ante - blind;
  });
  return {
    stacksBB,
    heroIdx: PREFLOP_ACTION_ORDER.indexOf(heroPosition),
    villainIdx: PREFLOP_ACTION_ORDER.indexOf(villainPosition),
  };
}

function mapToRecord(m: Map<string, StrategyMix>): Record<string, StrategyMix> {
  const record: Record<string, StrategyMix> = {};
  for (const hand of ALL_HANDS) {
    const mix = m.get(hand);
    if (mix) record[hand] = mix;
  }
  return record;
}

function loadOrBuildEquityMatrix(): EquityMatrix {
  if (fs.existsSync(EQUITY_CACHE_PATH)) {
    console.log(`Loading cached equity matrix from ${EQUITY_CACHE_PATH}`);
    return JSON.parse(fs.readFileSync(EQUITY_CACHE_PATH, "utf-8"));
  }
  console.log("No cached equity matrix found - building via Monte Carlo (a few minutes)...");
  const start = Date.now();
  const matrix = buildEquityMatrix(
    { comboPairSamples: 6, runoutsPerComboPair: 25, random: seededRandom(42) },
    (done, total) => {
      if (done % 2000 === 0 || done === total) {
        console.log(`  equity matrix: ${done}/${total} (${Math.round((Date.now() - start) / 1000)}s)`);
      }
    }
  );
  fs.mkdirSync(path.dirname(EQUITY_CACHE_PATH), { recursive: true });
  fs.writeFileSync(EQUITY_CACHE_PATH, JSON.stringify(matrix));
  console.log(`Equity matrix built and cached in ${Math.round((Date.now() - start) / 1000)}s`);
  return matrix;
}

function main() {
  const matrix = loadOrBuildEquityMatrix();
  const situations: Record<string, Record<string, StrategyMix>> = {};

  for (const format of GAME_FORMATS) {
    const deadMoney = deadMoneyPotBB(format);
    const evaluateStacks = evaluateStacksFor(format);
    const stackBuckets = stackDepthBucketsFor(format);
    // Rake only applies to cash (see gameTree.ts's resolveAllIn/resolveShowdownProxy doc) -
    // tournament solves once at the implicit 0% "rake" (its buy-in is sunk, not per-pot).
    const rakeTiers: CashRakePercent[] = format === "cash" ? CASH_RAKE_OPTIONS : [0];

    for (const rakePercent of rakeTiers) {
      const rakeLabel = format === "cash" ? ` rake ${(rakePercent * 100).toFixed(0)}%,` : "";
      console.log(`\n########## Format: ${format},${rakeLabel} ante ${anteToBBRatioFor(format)}BB, ${stackBuckets.length} stack buckets ##########`);

      for (const stackBB of stackBuckets) {
        const shoveOnly = isShoveOnlyDepth(stackBB);
        console.log(`\n=== [${format}${rakeLabel}] Stack bucket ${stackBB}BB (${shoveOnly ? "shove-only" : "deep-stack"}) ===`);

        for (const heroPosition of OPEN_POSITIONS) {
          const villainPosition = positionsAfter(heroPosition)[0];
          const table = buildSymmetricTable(heroPosition, villainPosition, stackBB, format);
          clearIcmCache(); // bound memory: cache within this solve, discard before the next

          if (shoveOnly) {
            const opponentsBehindCount = positionsAfter(heroPosition).length;
            const result = solvePushFoldUnopened(table, deadMoney, matrix, evaluateStacks, opponentsBehindCount, 12, rakePercent);
            situations[situationKey(heroPosition, stackBB, "rfi", format, rakePercent)] = mapToRecord(
              new Map(ALL_HANDS.map((h) => [h, { shove: result.shoveRange.get(h) ?? 0, fold: 1 - (result.shoveRange.get(h) ?? 0) } as StrategyMix]))
            );
            situations[situationKey(villainPosition, stackBB, "vsOpen", format, rakePercent)] = mapToRecord(
              new Map(ALL_HANDS.map((h) => [h, { call: result.callRange.get(h) ?? 0, fold: 1 - (result.callRange.get(h) ?? 0) } as StrategyMix]))
            );
            console.log(`  ${heroPosition} shove-or-fold, ${villainPosition} call-or-fold solved`);
          } else {
            const opponentsBehindCount = positionsAfter(heroPosition).length;
            const result = solveDeepStackPosition({
              table,
              deadMoneyPotBB: deadMoney,
              openSizeBB: OPEN_RAISE_SIZE_BB,
              threeBetSizeBB: OPEN_RAISE_SIZE_BB * THREE_BET_SIZE_MULTIPLIER_OOP,
              equityMatrix: matrix,
              evaluateStacks,
              opponentsBehindCount,
              iterations: 25,
              rakePercent,
            });
            situations[situationKey(heroPosition, stackBB, "rfi", format, rakePercent)] = mapToRecord(result.rfi);
            situations[situationKey(villainPosition, stackBB, "vsOpen", format, rakePercent)] = mapToRecord(result.vsOpen);
            situations[situationKey(heroPosition, stackBB, "vs3bet", format, rakePercent)] = mapToRecord(result.vs3bet);
            situations[situationKey(villainPosition, stackBB, "vs4bet", format, rakePercent)] = mapToRecord(result.vs4bet);
            console.log(`  ${heroPosition} rfi/vs3bet, ${villainPosition} vsOpen/vs4bet solved`);
          }
        }
      }
    }
  }

  fs.mkdirSync(path.dirname(SOLVER_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(SOLVER_OUTPUT_PATH, JSON.stringify({ situations }));
  console.log(`\nWrote ${Object.keys(situations).length} situations to ${SOLVER_OUTPUT_PATH}`);
}

main();
