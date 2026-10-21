import { useCallback, useEffect, useState } from "react";

const KEY = "jkt48c:theme";

export function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0b0d" : "#f6f3ee");
  }, [dark]);

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem(KEY, next ? "dark" : "light");
      } catch {
        /* storage diblokir — tema tetap berlaku untuk sesi ini */
      }
      return next;
    });
  }, []);

  return { dark, toggle };
}
