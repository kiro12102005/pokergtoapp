"use client";

import { useEffect } from "react";

/** Registers public/sw.js so previously-visited pages and the precomputed solver data (see
 *  solverLookup.ts) keep working with no/poor signal - e.g. inside a card room. Offline support
 *  is a nice-to-have, not a hard requirement, so a registration failure is swallowed silently
 *  rather than surfaced to the user. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
