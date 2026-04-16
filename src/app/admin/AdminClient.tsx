'use client'

import { useState } from 'react'

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
  slug: string
}

interface Props {
  hero: HeroData
  about: AboutData
  skills: SkillsData
  contact: ContactData
  experiences: ExpEntry[]
}

type SectionStatus = 'idle' | 'loading' | 'ok' | 'error'

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#e8e8e0',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  sidebar: {
    width: '200px',
    flexShrink: 0,
    backgroundColor: '#0f0f0f',
    borderRight: '1px solid #2a2a2a',
    padding: '2rem 0',
  } as React.CSSProperties,
  sidebarTitle: {
    color: '#c8f060',
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '0 1.25rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  navLink: (active: boolean): React.CSSProperties => ({
    display: 'block',
    padding: '0.6rem 1.25rem',
    color: active ? '#c8f060' : '#888880',
    cursor: 'pointer',
    fontSize: '0.875rem',
    background: active ? 'rgba(200, 240, 96, 0.07)' : 'transparent',
    borderLeft: active ? '2px solid #c8f060' : '2px solid transparent',
    transition: 'all 0.15s',
    textDecoration: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'monospace',
  }),
  main: {
    flex: 1,
    padding: '2rem 2.5rem',
    maxWidth: '800px',
  } as React.CSSProperties,
  heading: {
    color: '#e8e8e0',
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '2rem',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: '1rem',
  } as React.CSSProperties,
  label: {
    display: 'block',
    color: '#888880',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.4rem',
  } as React.CSSProperties,
  input: {
    display: 'block',
    width: '100%',
    background: '#141414',
    border: '1px solid #2a2a2a',
    color: '#e8e8e0',
    padding: '0.6rem 0.75rem',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    borderRadius: '3px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  textarea: {
    display: 'block',
    width: '100%',
    background: '#141414',
    border: '1px solid #2a2a2a',
    color: '#e8e8e0',
    padding: '0.6rem 0.75rem',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    borderRadius: '3px',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '90px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  fieldGroup: {
    marginBottom: '1.25rem',
  } as React.CSSProperties,
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  card: {
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    padding: '1rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  cardTitle: {
    color: '#888880',
    fontSize: '0.7rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  button: {
    background: '#c8f060',
    color: '#0a0a0a',
    fontWeight: 600,
    border: 'none',
    padding: '0.7rem 1.5rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    borderRadius: '3px',
    marginTop: '1.5rem',
  } as React.CSSProperties,
  status: (s: SectionStatus): React.CSSProperties => ({
    display: 'inline-block',
    marginLeft: '1rem',
    fontSize: '0.8rem',
    color: s === 'ok' ? '#c8f060' : s === 'error' ? '#ff6060' : '#888880',
    verticalAlign: 'middle',
  }),
}

export default function AdminClient({ hero: initialHero, about: initialAbout, skills: initialSkills, contact: initialContact, experiences: initialExperiences }: Props) {
  const [activeSection, setActiveSection] = useState<string>('hero')
  const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({})

  const [hero, setHero] = useState<HeroData>(initialHero)
  const [about, setAbout] = useState<AboutData>(initialAbout)
  const [skills, setSkills] = useState<SkillsData>(initialSkills)
  const [contact, setContact] = useState<ContactData>(initialContact)
  const [experiences, setExperiences] = useState<ExpEntry[]>(initialExperiences)

  async function save(section: string, data: unknown) {
    setStatuses(s => ({ ...s, [section]: 'loading' }))
    try {
      const res = await fetch('/api/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, data }),
      })
      if (res.ok) {
        setStatuses(s => ({ ...s, [section]: 'ok' }))
        setTimeout(() => setStatuses(s => ({ ...s, [section]: 'idle' })), 4000)
      } else {
        setStatuses(s => ({ ...s, [section]: 'error' }))
      }
    } catch {
      setStatuses(s => ({ ...s, [section]: 'error' }))
    }
  }

  const nav = [
    { key: 'hero', label: 'Hero' },
    { key: 'om', label: 'Om mig' },
    { key: 'erfaring', label: 'Erfaring' },
    { key: 'kompetencer', label: 'Kompetencer' },
    { key: 'kontakt', label: 'Kontakt' },
  ]

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <p style={styles.sidebarTitle}>Admin</p>
        {nav.map(n => (
          <button
            key={n.key}
            style={styles.navLink(activeSection === n.key)}
            onClick={() => setActiveSection(n.key)}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {activeSection === 'hero' && (
          <section>
            <h1 style={styles.heading}>Hero</h1>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tag</label>
              <input style={styles.input} value={hero.tag} onChange={e => setHero(h => ({ ...h, tag: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Beskrivelse</label>
              <textarea style={styles.textarea} value={hero.description} onChange={e => setHero(h => ({ ...h, description: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>CTA tekst</label>
              <input style={styles.input} value={hero.ctaText} onChange={e => setHero(h => ({ ...h, ctaText: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Stats</label>
              {hero.stats.map((stat, i) => (
                <div key={i} style={styles.row}>
                  <input
                    style={styles.input}
                    placeholder="Label"
                    value={stat.label}
                    onChange={e => setHero(h => ({ ...h, stats: h.stats.map((s, j) => j === i ? { ...s, label: e.target.value } : s) }))}
                  />
                  <input
                    style={styles.input}
                    placeholder="Værdi"
                    value={stat.value}
                    onChange={e => setHero(h => ({ ...h, stats: h.stats.map((s, j) => j === i ? { ...s, value: e.target.value } : s) }))}
                  />
                </div>
              ))}
            </div>
            <button style={styles.button} onClick={() => save('hero', hero)}>
              Gem ændringer
            </button>
            {statuses['hero'] && statuses['hero'] !== 'idle' && (
              <span style={styles.status(statuses['hero'])}>
                {statuses['hero'] === 'loading' ? 'Gemmer...' : statuses['hero'] === 'ok' ? 'Gemt!' : 'Fejl'}
              </span>
            )}
          </section>
        )}

        {activeSection === 'om' && (
          <section>
            <h1 style={styles.heading}>Om mig</h1>
            {(['paragraph1', 'paragraph2', 'paragraph3'] as const).map((key, i) => (
              <div key={key} style={styles.fieldGroup}>
                <label style={styles.label}>Afsnit {i + 1}</label>
                <textarea style={styles.textarea} value={about[key]} onChange={e => setAbout(a => ({ ...a, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Items</label>
              {about.items.map((item, i) => (
                <div key={i} style={styles.card}>
                  <p style={styles.cardTitle}>Item {i + 1}</p>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Ikon</label>
                    <input style={styles.input} value={item.icon} onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, icon: e.target.value } : it) }))} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Titel</label>
                    <input style={styles.input} value={item.title} onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) }))} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Beskrivelse</label>
                    <textarea style={styles.textarea} value={item.description} onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) }))} />
                  </div>
                </div>
              ))}
            </div>
            <button style={styles.button} onClick={() => save('about', about)}>
              Gem ændringer
            </button>
            {statuses['about'] && statuses['about'] !== 'idle' && (
              <span style={styles.status(statuses['about'])}>
                {statuses['about'] === 'loading' ? 'Gemmer...' : statuses['about'] === 'ok' ? 'Gemt!' : 'Fejl'}
              </span>
            )}
          </section>
        )}

        {activeSection === 'erfaring' && (
          <section>
            <h1 style={styles.heading}>Erfaring</h1>
            {experiences.map((exp, i) => (
              <div key={exp.slug} style={styles.card}>
                <p style={styles.cardTitle}>{exp.slug}</p>
                <div style={styles.row}>
                  <div>
                    <label style={styles.label}>Periode</label>
                    <input style={styles.input} value={exp.period} onChange={e => setExperiences(exps => exps.map((x, j) => j === i ? { ...x, period: e.target.value } : x))} />
                  </div>
                  <div>
                    <label style={styles.label}>Organisation</label>
                    <input style={styles.input} value={exp.org} onChange={e => setExperiences(exps => exps.map((x, j) => j === i ? { ...x, org: e.target.value } : x))} />
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Titel</label>
                  <input style={styles.input} value={exp.title} onChange={e => setExperiences(exps => exps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Beskrivelse</label>
                  <textarea style={styles.textarea} value={exp.description} onChange={e => setExperiences(exps => exps.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={styles.label}>Rækkefølge</label>
                  <input style={styles.input} type="number" value={exp.order ?? 0} onChange={e => setExperiences(exps => exps.map((x, j) => j === i ? { ...x, order: parseInt(e.target.value) || 0 } : x))} />
                </div>
              </div>
            ))}
            <button style={styles.button} onClick={() => save('experience', { entries: experiences })}>
              Gem ændringer
            </button>
            {statuses['erfaring'] && statuses['erfaring'] !== 'idle' && (
              <span style={styles.status(statuses['erfaring'])}>
                {statuses['erfaring'] === 'loading' ? 'Gemmer...' : statuses['erfaring'] === 'ok' ? 'Gemt!' : 'Fejl'}
              </span>
            )}
          </section>
        )}

        {activeSection === 'kompetencer' && (
          <section>
            <h1 style={styles.heading}>Kompetencer</h1>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Chips</label>
              {skills.chips.map((chip, i) => (
                <div key={i} style={styles.row}>
                  <input
                    style={styles.input}
                    placeholder="Navn"
                    value={chip.name}
                    onChange={e => setSkills(s => ({ ...s, chips: s.chips.map((c, j) => j === i ? { ...c, name: e.target.value } : c) }))}
                  />
                  <input
                    style={styles.input}
                    placeholder="Kategori"
                    value={chip.category}
                    onChange={e => setSkills(s => ({ ...s, chips: s.chips.map((c, j) => j === i ? { ...c, category: e.target.value } : c) }))}
                  />
                </div>
              ))}
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Roskilde titel</label>
              <input style={styles.input} value={skills.roskildeTitle} onChange={e => setSkills(s => ({ ...s, roskildeTitle: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Roskilde undertitel</label>
              <input style={styles.input} value={skills.roskildeSubtitle} onChange={e => setSkills(s => ({ ...s, roskildeSubtitle: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Roskilde badge</label>
              <input style={styles.input} value={skills.roskildeBadge} onChange={e => setSkills(s => ({ ...s, roskildeBadge: e.target.value }))} />
            </div>
            <button style={styles.button} onClick={() => save('skills', skills)}>
              Gem ændringer
            </button>
            {statuses['kompetencer'] && statuses['kompetencer'] !== 'idle' && (
              <span style={styles.status(statuses['kompetencer'])}>
                {statuses['kompetencer'] === 'loading' ? 'Gemmer...' : statuses['kompetencer'] === 'ok' ? 'Gemt!' : 'Fejl'}
              </span>
            )}
          </section>
        )}

        {activeSection === 'kontakt' && (
          <section>
            <h1 style={styles.heading}>Kontakt</h1>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Overskrift</label>
              <input style={styles.input} value={contact.heading} onChange={e => setContact(c => ({ ...c, heading: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Beskrivelse</label>
              <textarea style={styles.textarea} value={contact.description} onChange={e => setContact(c => ({ ...c, description: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>LinkedIn URL</label>
              <input style={styles.input} value={contact.linkedinUrl} onChange={e => setContact(c => ({ ...c, linkedinUrl: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
            </div>
            <button style={styles.button} onClick={() => save('contact', contact)}>
              Gem ændringer
            </button>
            {statuses['kontakt'] && statuses['kontakt'] !== 'idle' && (
              <span style={styles.status(statuses['kontakt'])}>
                {statuses['kontakt'] === 'loading' ? 'Gemmer...' : statuses['kontakt'] === 'ok' ? 'Gemt!' : 'Fejl'}
              </span>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
