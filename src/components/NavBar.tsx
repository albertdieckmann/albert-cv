"use client";

import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export default function NavBar() {
  return (
    <nav>
      <a href="#" className="nav-logo" id="nav-logo">AD_</a>
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
                elements: {
                  avatarBox: "nav-user-avatar",
                  userButtonPopoverCard: "clerk-popover",
                },
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
    </nav>
  );
}
