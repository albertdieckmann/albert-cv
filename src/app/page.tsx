import { createReader } from '@keystatic/core/reader'
import keystaticConfig from '../../keystatic.config'
import EasterEggs from "@/components/EasterEggs";
import NavBar from "@/components/NavBar";
import ContactForm from "@/components/ContactForm";

const reader = createReader(process.cwd(), keystaticConfig)

export default async function Home() {
  const [hero, about, experiences, skills, contact] = await Promise.all([
    reader.singletons.hero.read(),
    reader.singletons.about.read(),
    reader.collections.experience.all(),
    reader.singletons.skills.read(),
    reader.singletons.contact.read(),
  ])

  const sortedExp = [...(experiences ?? [])].sort(
    (a, b) => (a.entry.order ?? 0) - (b.entry.order ?? 0)
  )

  return (
    <>
      <NavBar />

      <section className="hero">
        <div className="hero-left">
          <p className="hero-tag">{hero?.tag ?? ''}</p>
          <h1>Albert<br /><em>Dieckmann</em></h1>
          <p className="hero-desc">{hero?.description ?? ''}</p>
          <a href="#kontakt" className="hero-cta">{hero?.ctaText ?? 'Tag kontakt →'}</a>
        </div>
        <div className="hero-right">
          {(hero?.stats ?? []).map((stat, i) => (
            <div key={i} className="hero-stat">
              <span className="hero-stat-label">{stat.label}</span>
              <span className="hero-stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="om">
        <p className="section-tag">Om mig</p>
        <div className="about-grid">
          <div className="about-text">
            <p>{about?.paragraph1 ?? ''}</p>
            <p>{about?.paragraph2 ?? ''}</p>
            <p>{about?.paragraph3 ?? ''}</p>
          </div>
          <div className="about-aside">
            {(about?.items ?? []).map((item, i) => (
              <div key={i} className="about-item">
                <span className="about-item-icon">{item.icon}</span>
                <div className="about-item-content">
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="erfaring">
        <p className="section-tag">Erfaring</p>
        <div className="exp-list">
          {sortedExp.map((exp) => (
            <div key={exp.slug} className="exp-item">
              <div className="exp-meta">
                {exp.entry.period}<span className="exp-org">{exp.entry.org}</span>
              </div>
              <div>
                <p className="exp-title">{exp.entry.title}</p>
                <p className="exp-desc">{exp.entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="kompetencer">
        <p className="section-tag">Kompetencer</p>
        <div className="skills-grid">
          {(skills?.chips ?? []).map((chip, i) => (
            <div key={i} className="skill-chip">
              {chip.name}<span>{chip.category}</span>
            </div>
          ))}
        </div>

        <div className="roskilde-box">
          <div>
            <p className="roskilde-title">{skills?.roskildeTitle ?? ''}</p>
            <p className="roskilde-sub">{skills?.roskildeSubtitle ?? ''}</p>
          </div>
          <span className="roskilde-badge">{skills?.roskildeBadge ?? ''}</span>
        </div>
      </section>

      <section id="kontakt">
        <div className="contact-inner">
          <div className="contact-text">
            <p className="section-tag">Kontakt</p>
            <h2>{contact?.heading ?? ''}</h2>
            <p>{contact?.description ?? ''}</p>
            <div className="contact-links" style={{ marginTop: "2rem" }}>
              <a
                href={contact?.linkedinUrl ?? 'https://linkedin.com/in/albertdieckmann'}
                className="contact-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>LinkedIn</span>
                <span className="contact-link-arrow">→</span>
              </a>
              <a href={`mailto:${contact?.email ?? 'hej@albertdieckmann.dk'}`} className="contact-link">
                <span>{contact?.email ?? 'hej@albertdieckmann.dk'}</span>
                <span className="contact-link-arrow">→</span>
              </a>
            </div>
          </div>
          <ContactForm />
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
