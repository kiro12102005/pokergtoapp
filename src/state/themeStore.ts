import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Persists the user's manual light/dark/system choice - see ThemeToggle.tsx, which applies it as
 * a `dark` class on <html> (globals.css redefines Tailwind's dark: variant to key off that class
 * - see @custom-variant dark - rather than the OS-level prefers-color-scheme media query, so an
 * explicit choice here can override the system default). A blocking inline script in layout.tsx
 * reads this same localStorage key before first paint to avoid a flash of the wrong theme.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "pokergto-theme" }
  )
);
