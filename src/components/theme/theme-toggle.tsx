"use client";

import { MoonStars, SunDim } from "@phosphor-icons/react";
import { navIconButtonClasses } from "@/components/dashboard/nav-action-styles";
import { useTheme } from "@/components/theme/theme-state";

export function ThemeToggle() {
  const { theme, mounted, setTheme } = useTheme();
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className={navIconButtonClasses}
    >
      {isDark ? (
        <SunDim size={20} weight="bold" aria-hidden />
      ) : (
        <MoonStars size={20} weight="bold" aria-hidden />
      )}
    </button>
  );
}
