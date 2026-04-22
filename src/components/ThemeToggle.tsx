"use client";

import { useState, useEffect } from "react";

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        color: "var(--muted)",
        cursor: "pointer",
        fontSize: "14px",
        width: "28px",
        height: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
