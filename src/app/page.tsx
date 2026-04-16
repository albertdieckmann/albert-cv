import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'

export const dynamic = 'force-dynamic'
import EasterEggs from "@/components/EasterEggs";
import NavBar from "@/components/NavBar";
import ContactForm from "@/components/ContactForm";
import GalleryCarousel from "@/components/GalleryCarousel";

function readYaml<T>(file: string): T {
  return yaml.load(readFileSync(join(process.cwd(), file), 'utf8')) as T
}

interface StatItem {
  label: string
  value: string
}

interface HeroData {
  tag: string
  description: string
  ctaText: string
  stats: StatItem[]
}

interface AboutItem {
  icon: string
  title: string
  description: string
}

interface AboutData {
  paragraph1: string
  paragraph2: string
  paragraph3: string
  items: AboutItem[]
}

interface ChipItem {
  name: string
  category: string
}

interface SkillsData {
  chips: ChipItem[]
  roskildeTitle: string
  roskildeSubtitle: string
  roskildeBadge: string
}

interface ContactData {
  heading: string
  description: string
  linkedinUrl: string
  email: string
}

interface ExpEntry {
  period: string
  org: string
  title: string
  description: string
  order?: number
  slug?: string
}

interface GalleryImage { filename: string; caption: string; order?: number }
interface GalleryData { images: GalleryImage[] }

export default async function Home() {
  const hero = readYaml<HeroData>('content/hero.yaml')
  const about = readYaml<AboutData>('content/about.yaml')
  const skills = readYaml<SkillsData>('content/skills.yaml')
  const contact = readYaml<ContactData>('content/contact.yaml')
  const gallery = readYaml<GalleryData>('content/gallery.yaml')

  const expFiles = readdirSync(join(process.cwd(), 'content/experience'))
  const experiences = expFiles
    .map(f => {
      const entry = readYaml<ExpEntry>('content/experience/' + f)
      return { ...entry, slug: f.replace('.yaml', '') }
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

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
          {experiences.map((exp) => (
            <div key={exp.slug} className="exp-item">
              <div className="exp-meta">
                {exp.period}<span className="exp-org">{exp.org}</span>
              </div>
              <div>
                <p className="exp-title">{exp.title}</p>
                <p className="exp-desc">{exp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(gallery?.images ?? []).length > 0 && (
        <section id="galleri">
          <p className="section-tag">Galleri</p>
          <GalleryCarousel images={gallery.images.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))} />
        </section>
      )}

      <section id="kompetencer">
        <p className="section-tag">Kompetencer</p>
        <div className="skills-grid">
          {(skills?.chips ?? []).map((chip, i) => (
            <div key={i} className="skill-chip">
              {chip.name}<span>{chip.category}</span>
            </div>
          ))}
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
