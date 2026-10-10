import { useEffect, useState } from "react";

// Theme preference: 'system' follows the device, 'light'/'dark' override it.
// The root THEME_SCRIPT applies the stored choice before first paint; this
// hook reads/writes the same key and pokes that script to re-apply live.

export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "ck-theme";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(getThemePref);

  useEffect(() => {
    // Keep multiple tabs/components in sync.
    const sync = () => setThemeState(getThemePref());
    window.addEventListener("ck-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ck-theme-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function setTheme(next: ThemePref) {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
    setThemeState(next);
    window.dispatchEvent(new Event("ck-theme-change"));
  }

  return { theme, setTheme };
}
