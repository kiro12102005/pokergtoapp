export interface PotDisplayProps {
  potBB: number;
}

export function PotDisplay({ potBB }: PotDisplayProps) {
  return (
    <div className="rounded-full bg-black/70 px-4 py-1 text-sm font-semibold text-white shadow">
      Pot: {potBB.toFixed(1)}BB
    </div>
  );
}
