import { ActionEvent, ScenarioState } from "@/domain/scenario/scenarioState";
import { SEAT_RING_ORDER, Position } from "@/domain/table/seats";
import { Seat } from "./Seat";

export interface SeatRingProps {
  scenario: ScenarioState;
}

function lastActionFor(actionHistory: ActionEvent[], position: Position): ActionEvent | undefined {
  return [...actionHistory].reverse().find((e) => e.position === position);
}

export function SeatRing({ scenario }: SeatRingProps) {
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-xl">
      <div className="absolute inset-[10%] rounded-[45%] border-4 border-emerald-800 bg-emerald-700 shadow-inner dark:border-emerald-900 dark:bg-emerald-800" />
      {SEAT_RING_ORDER.map((position, i) => {
        const angle = (i / SEAT_RING_ORDER.length) * 2 * Math.PI - Math.PI / 2;
        const left = 50 + 46 * Math.cos(angle);
        const top = 50 + 44 * Math.sin(angle);
        const stackBB = scenario.stacks[position] / scenario.bb;
        return (
          <Seat
            key={position}
            position={position}
            stackBB={stackBB}
            isHero={position === scenario.heroPosition}
            isToAct={position === scenario.toAct}
            lastAction={lastActionFor(scenario.actionHistory, position)}
            style={{ left: `${left}%`, top: `${top}%` }}
          />
        );
      })}
    </div>
  );
}
