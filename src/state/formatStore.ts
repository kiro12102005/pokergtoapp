import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CashRakePercent, GameFormat } from "@/domain/table/gameFormat";

interface FormatState {
  /** Which game the analyze/train pages currently model - shared across both pages (not
   *  per-page state) so switching on one carries over to the other, same as themeStore.ts /
   *  apiKeyStore.ts's persisted-and-shared pattern. */
  format: GameFormat;
  /** Only meaningful when format is "cash" - see domain/table/gameFormat.ts's CashRakePercent
   *  doc. Preserved (not reset) when switching away from cash, so toggling back restores it. */
  cashRake: CashRakePercent;
  setFormat: (format: GameFormat) => void;
  setCashRake: (rake: CashRakePercent) => void;
}

export const useFormatStore = create<FormatState>()(
  persist(
    (set) => ({
      format: "tournament",
      cashRake: 0,
      setFormat: (format) => set({ format }),
      setCashRake: (cashRake) => set({ cashRake }),
    }),
    { name: "pokergto-format" }
  )
);
