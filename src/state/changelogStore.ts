import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChangelogState {
  /** The date (see ChangelogEntry.date) of the newest entry the user has seen - null before
   *  their first visit to /updates. Persisted so the unread badge (see NavBar.tsx) survives a
   *  reload, the same "stays on this device" posture as apiKeyStore.ts. */
  lastSeenDate: string | null;
  markSeen: (latestDate: string) => void;
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set) => ({
      lastSeenDate: null,
      markSeen: (latestDate) => set({ lastSeenDate: latestDate }),
    }),
    { name: "pokergto-changelog-last-seen" }
  )
);
