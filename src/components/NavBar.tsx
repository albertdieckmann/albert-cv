"use client";

import { useState, useEffect } from "react";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <>
      <nav>
        <a href="#" className="nav-logo" id="nav-logo">AD_</a>

        {/* Desktop links */}
        <ul className="nav-links">
          <li><a href="#projekter">Projekter</a></li>
          <li><a href="#om">Om</a></li>
          <li><a href="#erfaring">Erfaring</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
        </ul>

        <div className="nav-actions">
          <button
            className="nav-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}
            title={theme === "dark" ? "Lyst tema" : "Mørkt tema"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>

          {/* Hamburger knap (kun mobil) */}
          <button
            className="nav-hamburger"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className={`nav-hamburger-line ${open ? "open" : ""}`} />
            <span className={`nav-hamburger-line ${open ? "open" : ""}`} />
            <span className={`nav-hamburger-line ${open ? "open" : ""}`} />
          </button>
        </div>
      </nav>

      {/* Mobil menu */}
      {open && (
        <div className="nav-mobile" onClick={() => setOpen(false)}>
          <a href="#projekter" className="nav-mobile-link">Projekter</a>
          <a href="#om" className="nav-mobile-link">Om</a>
          <a href="#erfaring" className="nav-mobile-link">Erfaring</a>
          <a href="#kontakt" className="nav-mobile-link">Kontakt</a>
        </div>
      )}
    </>
  );
}
