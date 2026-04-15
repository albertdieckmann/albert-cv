"use client";

import { useEffect, useState } from "react";

export default function EasterEggs() {
  const [eggActive, setEggActive] = useState(false);

  useEffect(() => {
    // Konami code
    const konami = [
      "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
      "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a",
    ];
    let konamiIdx = 0;
    const onKey = (e: KeyboardEvent) => {
      konamiIdx = e.key === konami[konamiIdx] ? konamiIdx + 1 : 0;
      if (konamiIdx === konami.length) {
        setEggActive(true);
        konamiIdx = 0;
      }
    };
    document.addEventListener("keydown", onKey);

    // Logo click (10x)
    let logoClicks = 0;
    const logo = document.getElementById("nav-logo");
    const onLogoClick = (e: Event) => {
      e.preventDefault();
      if (++logoClicks >= 10) {
        logo!.textContent = "🤖";
        setTimeout(() => { logo!.textContent = "AD_"; logoClicks = 0; }, 3000);
      }
    };
    logo?.addEventListener("click", onLogoClick);

    // Footer secret (5x)
    let footerClicks = 0;
    const footer = document.getElementById("footer-secret");
    const onFooterClick = () => {
      if (++footerClicks >= 5) {
        footer!.textContent = "Hej mamma 👋";
        footerClicks = 0;
        setTimeout(() => { footer!.textContent = "albertdieckmann.dk"; }, 3000);
      }
    };
    footer?.addEventListener("click", onFooterClick);

    // Scroll entrance animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".exp-item, .about-item, .skill-chip, .hero-stat").forEach((el) => {
      const h = el as HTMLElement;
      h.style.opacity = "0";
      h.style.transform = "translateY(20px)";
      h.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      observer.observe(el);
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      logo?.removeEventListener("click", onLogoClick);
      footer?.removeEventListener("click", onFooterClick);
      observer.disconnect();
    };
  }, []);

  if (!eggActive) return null;

  return (
    <div id="easter-egg" className="active">
      <h3>🥚 Du fandt det!</h3>
      <p>
        ↑ ↑ ↓ ↓ ← → ← → B A<br />
        Den klassiske kode. Imponeret over din dedikation.
      </p>
      <button onClick={() => setEggActive(false)}>
        Luk og gå tilbage til det normale
      </button>
    </div>
  );
}
