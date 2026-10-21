import { useCallback, useEffect, useState } from "react";

const KEY = "jkt48c:theme";

export function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141012" : "#f3eee6");
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
