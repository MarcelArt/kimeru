import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "#/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const light = mounted && resolvedTheme === "light";
  const label = light ? "Switch to dark theme" : "Switch to light theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(light ? "dark" : "light")}
    >
      {light ? <Moon /> : <Sun />}
    </Button>
  );
}
