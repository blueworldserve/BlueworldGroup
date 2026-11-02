import { Moon, Sun } from "lucide-react";
import { useCmsTheme } from "@/hooks/use-cms-theme";

export function ThemeToggle() {
  const { theme, toggle } = useCmsTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-foreground/75 transition-colors hover:bg-primary-soft sm:h-10 sm:w-10"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}