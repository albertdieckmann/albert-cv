"use client";

import { useState } from "react";

export default function NavBar() {
  const [open, setOpen] = useState(false);

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
