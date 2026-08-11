"use client";

import { useEffect } from "react";
import { Theme, useThemeStore } from "@/state/themeStore";
import { MonitorIcon, MoonIcon, SunIcon } from "./NavIcons";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "システム", light: "ライト", dark: "ダーク" };
const ICON: Record<Theme, typeof SunIcon> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/**
 * A small fixed icon button (not a NavBar link, so it doesn't compete with the bottom tab bar's
 * limited slots or the top pill nav) that cycles system -> light -> dark -> system. Applies the
 * resolved choice as a `dark` class on <html> - see globals.css's @custom-variant dark, which
 * makes every dark: utility class in this app key off that class instead of the
 * prefers-color-scheme media query. The class itself is first set synchronously before paint by
 * a blocking script in layout.tsx (see THEME_INIT_SCRIPT there); this effect keeps it in sync
 * with store changes and live OS theme changes while in "system" mode.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const cycle = () => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]);
  const Icon = ICON[theme];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`表示テーマ: ${LABEL[theme]}(タップで切り替え)`}
      title={`表示テーマ: ${LABEL[theme]}`}
      className="fixed top-2 right-2 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white/90 text-zinc-600 shadow-sm backdrop-blur hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
