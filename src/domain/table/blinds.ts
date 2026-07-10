export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  durationMinutes: number;
}

export function effectiveStackInBB(effectiveStackChips: number, bb: number): number {
  return effectiveStackChips / bb;
}
