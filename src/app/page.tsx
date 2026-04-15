import EasterEggs from "@/components/EasterEggs";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <>
      <NavBar />

      <section className="hero">
        <div className="hero-left">
          <p className="hero-tag">Tilgængelig for nye projekter</p>
          <h1>Albert<br /><em>Dieckmann</em></h1>
          <p className="hero-desc">
            Delivery manager, product owner og GenAI-teamleder hos DR.
            Starter i kommunikation, ender altid med at skrive YAML.
          </p>
          <a href="#kontakt" className="hero-cta">Tag kontakt →</a>
        </div>
        <div className="hero-right">
          <div className="hero-stat">
            <span className="hero-stat-label">Nuværende rolle</span>
            <span className="hero-stat-value">Teamleder</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Arbejdsplads</span>
            <span className="hero-stat-value">DR / GenAI</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Roskilde Festival</span>
            <span className="hero-stat-value">Teamchef</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Baggrund</span>
            <span className="hero-stat-value">Komm. & Marketing</span>
          </div>
        </div>
      </section>

      <section id="om">
        <p className="section-tag">Om mig</p>
        <div className="about-grid">
          <div className="about-text">
            <p>
              Jeg startede min karriere i <strong>kommunikation og markedsføring</strong> –
              men det varede ikke længe inden IT trak mig ind. Det viser sig at organisationer,
              processer og teknologi er mere interessant end at skrive pressemeddelelser.
            </p>
            <p>
              I dag leder jeg <strong>DR&apos;s GenAI-team</strong>, hvor vi arbejder med at
              omsætte kunstig intelligens til noget der rent faktisk giver mening i en
              medievirksomhed. Inden da har jeg brugt år på at lære offentlige organisationer
              op i agil leverance – primært i Skatteforvaltningen.
            </p>
            <p>Jeg er mest glad når der er en klar retning, et engageret team og kaffe inden standup.</p>
          </div>
          <div className="about-aside">
            <div className="about-item">
              <span className="about-item-icon">01</span>
              <div className="about-item-content">
                <strong>Levering & struktur</strong>
                <p>Scrum, SAFe, agil leverance i komplekse organisationer</p>
              </div>
            </div>
            <div className="about-item">
              <span className="about-item-icon">02</span>
              <div className="about-item-content">
                <strong>GenAI & produktudvikling</strong>
                <p>Fra idé til produkt – med AI som drivkraft</p>
              </div>
            </div>
            <div className="about-item">
              <span className="about-item-icon">03</span>
              <div className="about-item-content">
                <strong>Kommunikation</strong>
                <p>Fortælle historier der giver tekniske beslutninger mening</p>
              </div>
            </div>
            <div className="about-item">
              <span className="about-item-icon">🎪</span>
              <div className="about-item-content">
                <strong>Roskilde Festival</strong>
                <p>Frivillig teamchef for intern pressehåndtering under afvikling</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="erfaring">
        <p className="section-tag">Erfaring</p>
        <div className="exp-list">
          <div className="exp-item">
            <div className="exp-meta">
              Nu<span className="exp-org">DR</span>
            </div>
            <div>
              <p className="exp-title">Teamleder, GenAI</p>
              <p className="exp-desc">
                Leder DR&apos;s GenAI-team med fokus på at omsætte AI-teknologi til konkrete
                medieværdier. Delivery manager og product owner på tværs af initiativer der
                rykker Danmarks Radio ind i en ny teknologisk æra.
              </p>
            </div>
          </div>
          <div className="exp-item">
            <div className="exp-meta">
              Tidligere<span className="exp-org">Skatteforvaltningen</span>
            </div>
            <div>
              <p className="exp-title">Release Train Engineer</p>
              <p className="exp-desc">
                Ansvarlig for koordination og leverance på tværs af agile teams i en af Danmarks
                største offentlige IT-organisationer. SAFe-certificeret og med fingrene dybt nede
                i PI Planning og afhængighedsstyring.
              </p>
            </div>
          </div>
          <div className="exp-item">
            <div className="exp-meta">
              Tidligere<span className="exp-org">Skatteforvaltningen</span>
            </div>
            <div>
              <p className="exp-title">Scrum Master</p>
              <p className="exp-desc">
                Faciliterede agile processer og sikrede at teams kunne levere. Arbejdede med at
                fjerne forhindringer, bygge tillid og skabe et miljø hvor folk rent faktisk gad
                møde til standup.
              </p>
            </div>
          </div>
          <div className="exp-item">
            <div className="exp-meta">
              Frivillig<span className="exp-org">Roskilde Festival</span>
            </div>
            <div>
              <p className="exp-title">Teamchef, intern pressehåndtering</p>
              <p className="exp-desc">
                Leder et frivilligt team der håndterer intern pressekommunikation under
                festivalens afvikling. Beviset på at man godt kan koordinere komplekse processer
                med mudder på støvlerne og en øl i hånden.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="kompetencer">
        <p className="section-tag">Kompetencer</p>
        <div className="skills-grid">
          <div className="skill-chip">GenAI & AI-produktudvikling<span>Teknologi</span></div>
          <div className="skill-chip">Product Ownership<span>Ledelse</span></div>
          <div className="skill-chip">Delivery Management<span>Ledelse</span></div>
          <div className="skill-chip">Scrum & SAFe<span>Agil</span></div>
          <div className="skill-chip">Release Train Engineering<span>Agil</span></div>
          <div className="skill-chip">Teamledelse<span>People</span></div>
          <div className="skill-chip">Kommunikation<span>Baggrund</span></div>
          <div className="skill-chip">Stakeholder Management<span>Ledelse</span></div>
          <div className="skill-chip">Pressehåndtering<span>Komm.</span></div>
          <div className="skill-chip">Forandringsledelse<span>Org.</span></div>
        </div>

        <div className="roskilde-box">
          <div>
            <p className="roskilde-title">Roskilde Festival</p>
            <p className="roskilde-sub">
              Frivillig teamchef for intern pressehåndtering · Under afvikling · Hvert år
            </p>
          </div>
          <span className="roskilde-badge">Frivillig</span>
        </div>
      </section>

      <section id="kontakt">
        <div className="contact-inner">
          <div className="contact-text">
            <p className="section-tag">Kontakt</p>
            <h2>Lad os tage en snak.</h2>
            <p>
              Har du et projekt, en idé eller bare lyst til at tale om GenAI,
              agil leverance eller Roskilde Festival?
            </p>
          </div>
          <div className="contact-links">
            <a
              href="https://linkedin.com/in/albertdieckmann"
              className="contact-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>LinkedIn</span>
              <span className="contact-link-arrow">→</span>
            </a>
            <a href="mailto:hej@albertdieckmann.dk" className="contact-link">
              <span>hej@albertdieckmann.dk</span>
              <span className="contact-link-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <footer>
        <p>© 2025 Albert Dieckmann</p>
        <p id="footer-secret">albertdieckmann.dk</p>
      </footer>

      <EasterEggs />
    </>
  );
}
