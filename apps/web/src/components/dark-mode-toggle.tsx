"use client";

import { Moon, Sun } from "lucide-react";
import SquishSwitch from "./squish-switch";
import { useTheme } from "./theme-provider";

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <SquishSwitch
      checked={theme === "dark"}
      onChange={(checked) => setTheme(checked ? "dark" : "light")}
      ariaLabel="Toggle dark mode"
      width={46}
      height={26}
      radius={13}
      trackColor="var(--muted)"
      trackOnColor="var(--foreground)"
      thumbColor="var(--background)"
      thumbOnColor="var(--background)"
      iconOff={<Sun size={12} color="var(--foreground)" strokeWidth={2.5} />}
      iconOn={<Moon size={12} color="var(--foreground)" strokeWidth={2.5} />}
    />
  );
}
