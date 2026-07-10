/**
 * Offline precompute step for Phase 1's preflop solver. Run via `npm run precompute:preflop`.
 *
 * Two stages:
 *  1. Build (or load the cached) 169x169 canonical-hand equity matrix via Monte Carlo.
 *  2. For every (position, stack-depth bucket) situation, solve either the ICM push/fold
 *     Nash (shove-only depths) or the deep-stack iterated-best-response tree (deeper depths),
 *     and write the resulting strategies to src/data/solverOutput/preflop.json.
 *
 * Both solvers use a "symmetric stack" table (every seat at the bucket's BB depth) for this
 * production table - see pushFoldSolver.ts / cfrSolver.ts for the full generic API, which
 * also accepts arbitrary (asymmetric) stack distributions, used by the ICM-sensitivity test.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PREFLOP_ACTION_ORDER, Position, positionsAfter } from "../src/domain/table/seats";
import { ALL_HANDS } from "../src/domain/cards/handNotation";
import { seededRandom } from "../src/domain/cards/deck";
import { StrategyMix } from "../src/domain/scenario/scenarioState";
import { buildEquityMatrix, EquityMatrix } from "../src/engine/equity/equityMatrix";
import { clearIcmCache } from "../src/engine/icm/icm";
import {
  ANTE_TO_BB_RATIO,
  OPEN_RAISE_SIZE_BB,
  STACK_DEPTH_BUCKETS_BB,
  THREE_BET_SIZE_MULTIPLIER_OOP,
  isShoveOnlyDepth,
  situationKey,
} from "../src/engine/solver/abstraction";
import { solvePushFoldUnopened } from "../src/engine/solver/pushFoldSolver";
import { solveDeepStackPosition } from "../src/engine/solver/cfrSolver";
import { TableStacksBB } from "../src/engine/solver/gameTree";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EQUITY_CACHE_PATH = path.join(__dirname, "../src/data/equity/preflopEquity169.json");
const SOLVER_OUTPUT_PATH = path.join(__dirname, "../src/data/solverOutput/preflop.json");

const OPEN_POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB"];

const SB_AMOUNT_BB = 0.5;
const BB_AMOUNT_BB = 1;

function deadMoneyPotBB(): number {
  const ante = ANTE_TO_BB_RATIO;
  return SB_AMOUNT_BB + BB_AMOUNT_BB + 6 * ante;
}

/**
 * Builds a table where every seat starts at `stackBB` and then has its own blind/ante
 * deducted, so the dead money handed to whoever wins the pot is actually sourced from
 * players' stacks (conservation of chips) rather than materializing on top of them.
 */
function buildSymmetricTable(
  heroPosition: Position,
  villainPosition: Position,
  stackBB: number
): TableStacksBB {
  const ante = ANTE_TO_BB_RATIO;
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
  const deadMoney = deadMoneyPotBB();

  for (const stackBB of STACK_DEPTH_BUCKETS_BB) {
    const shoveOnly = isShoveOnlyDepth(stackBB);
    console.log(`\n=== Stack bucket ${stackBB}BB (${shoveOnly ? "shove-only" : "deep-stack"}) ===`);

    for (const heroPosition of OPEN_POSITIONS) {
      const villainPosition = positionsAfter(heroPosition)[0];
      const table = buildSymmetricTable(heroPosition, villainPosition, stackBB);
      clearIcmCache(); // bound memory: cache within this solve, discard before the next

      if (shoveOnly) {
        const opponentsBehindCount = positionsAfter(heroPosition).length;
        const result = solvePushFoldUnopened(table, deadMoney, matrix, opponentsBehindCount);
        situations[situationKey(heroPosition, stackBB, "rfi")] = mapToRecord(
          new Map(ALL_HANDS.map((h) => [h, { shove: result.shoveRange.get(h) ?? 0, fold: 1 - (result.shoveRange.get(h) ?? 0) } as StrategyMix]))
        );
        situations[situationKey(villainPosition, stackBB, "vsOpen")] = mapToRecord(
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
          opponentsBehindCount,
          iterations: 25,
        });
        situations[situationKey(heroPosition, stackBB, "rfi")] = mapToRecord(result.rfi);
        situations[situationKey(villainPosition, stackBB, "vsOpen")] = mapToRecord(result.vsOpen);
        situations[situationKey(heroPosition, stackBB, "vs3bet")] = mapToRecord(result.vs3bet);
        situations[situationKey(villainPosition, stackBB, "vs4bet")] = mapToRecord(result.vs4bet);
        console.log(`  ${heroPosition} rfi/vs3bet, ${villainPosition} vsOpen/vs4bet solved`);
      }
    }
  }

  fs.mkdirSync(path.dirname(SOLVER_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(SOLVER_OUTPUT_PATH, JSON.stringify({ situations }));
  console.log(`\nWrote ${Object.keys(situations).length} situations to ${SOLVER_OUTPUT_PATH}`);
}

main();
