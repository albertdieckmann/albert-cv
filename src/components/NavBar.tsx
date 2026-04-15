"use client";

import { useState } from "react";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav>
        <a href="#" className="nav-logo" id="nav-logo">AD_</a>

        {/* Desktop links */}
        <ul className="nav-links">
          <li><a href="#om">Om</a></li>
          <li><a href="#erfaring">Erfaring</a></li>
          <li><a href="#kompetencer">Kompetencer</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
          <li>
            <Show when="signed-out">
              <SignInButton>
                <button className="nav-auth-btn">Log ind</button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: { avatarBox: "nav-user-avatar" },
                  variables: {
                    colorPrimary: "#c8f060",
                    colorBackground: "#111111",
                    colorText: "#f0ede6",
                    colorTextSecondary: "#888880",
                    colorInputBackground: "#1a1a1a",
                    colorInputText: "#f0ede6",
                    borderRadius: "0px",
                    fontFamily: "var(--font-dm-mono)",
                  },
                }}
              />
            </Show>
          </li>
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
          <a href="#om" className="nav-mobile-link">Om</a>
          <a href="#erfaring" className="nav-mobile-link">Erfaring</a>
          <a href="#kompetencer" className="nav-mobile-link">Kompetencer</a>
          <a href="#kontakt" className="nav-mobile-link">Kontakt</a>
          <div className="nav-mobile-auth">
            <Show when="signed-out">
              <SignInButton>
                <button className="nav-auth-btn">Log ind</button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton
                appearance={{
                  variables: {
                    colorPrimary: "#c8f060",
                    colorBackground: "#111111",
                    colorText: "#f0ede6",
                    borderRadius: "0px",
                  },
                }}
              />
            </Show>
          </div>
        </div>
      )}
    </>
  );
}
