export type ThemeChoice = "light" | "dark";

export const THEME_STORAGE_KEY = "indoquake-theme";

/** Runs before first paint (inline in <head>) so the stored theme never flashes. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export function readThemeChoice(): ThemeChoice | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function currentTheme(): ThemeChoice {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent("indoquake:theme", { detail: choice }));
}
