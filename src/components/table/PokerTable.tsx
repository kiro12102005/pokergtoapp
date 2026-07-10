import { ScenarioState } from "@/domain/scenario/scenarioState";
import { Card } from "@/domain/cards/card";
import { SeatRing } from "./SeatRing";
import { HoleCards } from "./HoleCards";
import { BoardCards } from "./BoardCards";
import { PotDisplay } from "./PotDisplay";

export interface PokerTableProps {
  scenario: ScenarioState;
  onChangeHeroCard: (index: 0 | 1, card: Card) => void;
}

export function PokerTable({ scenario, onChangeHeroCard }: PokerTableProps) {
  return (
    <div className="relative">
      <SeatRing scenario={scenario} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="pointer-events-auto">
          <PotDisplay potBB={scenario.potBB} />
        </div>
        <BoardCards board={scenario.board} />
        <div className="pointer-events-auto">
          <HoleCards cards={scenario.heroCards} onChangeCard={onChangeHeroCard} />
        </div>
        <div className="text-xs font-semibold text-white drop-shadow">
          {scenario.heroPosition} · {Math.round(scenario.effectiveStackBB)}BB
        </div>
      </div>
    </div>
  );
}
