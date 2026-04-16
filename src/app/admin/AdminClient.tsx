'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'

interface StatItem { label: string; value: string }
interface HeroData { tag: string; description: string; ctaText: string; stats: StatItem[] }
interface AboutItem { icon: string; title: string; description: string }
interface AboutData { paragraph1: string; paragraph2: string; paragraph3: string; items: AboutItem[] }
interface ChipItem { name: string; category: string }
interface SkillsData { chips: ChipItem[]; roskildeTitle: string; roskildeSubtitle: string; roskildeBadge: string }
interface ContactData { heading: string; description: string; linkedinUrl: string; email: string }
interface ExpEntry { period: string; org: string; title: string; description: string; order?: number; slug: string }

interface Props {
  hero: HeroData
  about: AboutData
  skills: SkillsData
  contact: ContactData
  experiences: ExpEntry[]
}

type Status = 'idle' | 'loading' | 'ok' | 'error'

const s = {
  wrap: { display: 'flex', minHeight: '100vh', background: '#0a0a0a', color: '#e8e8e0', fontFamily: 'monospace' } as React.CSSProperties,
  sidebar: { width: '220px', flexShrink: 0, background: '#0d0d0d', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column' as const },
  sidebarTop: { padding: '4rem 1.5rem 1rem', borderBottom: '1px solid #1e1e1e' },
  brand: { color: '#c8f060', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, fontWeight: 700, margin: 0 },
  backLink: { color: '#888880', fontSize: '0.75rem', textDecoration: 'none', display: 'block', marginTop: '0.5rem' },
  nav: { padding: '1rem 0', flex: 1 },
  navItem: (active: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', padding: '0.6rem 1.5rem',
    background: active ? 'rgba(200,240,96,0.06)' : 'transparent',
    borderLeft: `2px solid ${active ? '#c8f060' : 'transparent'}`,
    color: active ? '#e8e8e0' : '#888880',
    fontSize: '0.85rem', cursor: 'pointer', border: 'none',
    borderLeftStyle: 'solid', borderLeftWidth: '2px',
    borderLeftColor: active ? '#c8f060' : 'transparent',
    textAlign: 'left', fontFamily: 'monospace', transition: 'all 0.1s',
  }),
  sidebarBottom: { padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e' },
  signOut: { background: 'none', border: '1px solid #2a2a2a', color: '#888880', fontSize: '0.75rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontFamily: 'monospace', width: '100%' } as React.CSSProperties,
  main: { flex: 1, padding: '2.5rem 3rem', maxWidth: '800px', overflowY: 'auto' as const },
  sectionTitle: { fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888880', margin: '0 0 0.5rem' },
  sectionHeading: { fontSize: '1.4rem', fontWeight: 600, color: '#e8e8e0', margin: '0 0 2rem', paddingBottom: '1rem', borderBottom: '1px solid #1e1e1e' },
  label: { display: 'block', color: '#666660', fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '0.35rem' } as React.CSSProperties,
  input: { display: 'block', width: '100%', background: '#111', border: '1px solid #222', color: '#e8e8e0', padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const, marginBottom: '1.25rem' } as React.CSSProperties,
  textarea: { display: 'block', width: '100%', background: '#111', border: '1px solid #222', color: '#e8e8e0', padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', outline: 'none', resize: 'vertical' as const, minHeight: '90px', boxSizing: 'border-box' as const, marginBottom: '1.25rem' } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' } as React.CSSProperties,
  card: { background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '1.25rem', marginBottom: '1rem' } as React.CSSProperties,
  cardLabel: { color: '#555550', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 1rem', fontFamily: 'monospace' } as React.CSSProperties,
  footer: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #1e1e1e' } as React.CSSProperties,
  btn: (loading: boolean): React.CSSProperties => ({ background: loading ? '#8aa840' : '#c8f060', color: '#0a0a0a', fontWeight: 700, border: 'none', padding: '0.65rem 1.5rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'monospace', fontSize: '0.85rem', letterSpacing: '0.03em' }),
  statusMsg: (st: Status): React.CSSProperties => ({ fontSize: '0.8rem', color: st === 'ok' ? '#c8f060' : st === 'error' ? '#ff6060' : '#888880' }),
}

function SaveBar({ section, status, onSave }: { section: string; status: Status; onSave: () => void }) {
  return (
    <div style={s.footer}>
      <button style={s.btn(status === 'loading')} onClick={onSave} disabled={status === 'loading'}>
        {status === 'loading' ? 'Gemmer...' : 'Gem ændringer'}
      </button>
      {status === 'ok' && <span style={s.statusMsg('ok')}>✓ Gemt! Siden opdateres om ~30 sek.</span>}
      {status === 'error' && <span style={s.statusMsg('error')}>Noget gik galt — prøv igen</span>}
    </div>
  )
}

export default function AdminClient({ hero: h0, about: a0, skills: sk0, contact: c0, experiences: ex0 }: Props) {
  const { signOut } = useClerk()
  const [active, setActive] = useState('hero')
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [hero, setHero] = useState(h0)
  const [about, setAbout] = useState(a0)
  const [skills, setSkills] = useState(sk0)
  const [contact, setContact] = useState(c0)
  const [exps, setExps] = useState(ex0)

  async function save(key: string, data: unknown) {
    setStatuses(prev => ({ ...prev, [key]: 'loading' }))
    try {
      const res = await fetch('/api/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: key, data }),
      })
      const status: Status = res.ok ? 'ok' : 'error'
      setStatuses(prev => ({ ...prev, [key]: status }))
      if (res.ok) setTimeout(() => setStatuses(prev => ({ ...prev, [key]: 'idle' })), 4000)
    } catch {
      setStatuses(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  const nav = [
    { key: 'hero', label: '🏠 Hero' },
    { key: 'om', label: '👤 Om mig' },
    { key: 'erfaring', label: '💼 Erfaring' },
    { key: 'kompetencer', label: '🧠 Kompetencer' },
    { key: 'kontakt', label: '✉️ Kontakt' },
  ]

  return (
    <div style={s.wrap}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarTop}>
          <p style={s.brand}>AD_ Admin</p>
          <a href="/" style={s.backLink}>← Tilbage til siden</a>
        </div>
        <nav style={s.nav}>
          {nav.map(n => (
            <button key={n.key} style={s.navItem(active === n.key)} onClick={() => setActive(n.key)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={s.sidebarBottom}>
          <button style={s.signOut} onClick={() => signOut({ redirectUrl: '/' })}>Log ud</button>
        </div>
      </div>

      {/* Indhold */}
      <main style={s.main}>

        {/* HERO */}
        {active === 'hero' && <>
          <p style={s.sectionTitle}>Forside</p>
          <h1 style={s.sectionHeading}>Hero</h1>

          <label style={s.label}>Topbanner</label>
          <input style={s.input} value={hero.tag} onChange={e => setHero(h => ({ ...h, tag: e.target.value }))} />

          <label style={s.label}>Beskrivelse</label>
          <textarea style={s.textarea} value={hero.description} onChange={e => setHero(h => ({ ...h, description: e.target.value }))} />

          <label style={s.label}>Knaptekst</label>
          <input style={s.input} value={hero.ctaText} onChange={e => setHero(h => ({ ...h, ctaText: e.target.value }))} />

          <label style={s.label}>Faktaboks</label>
          {hero.stats.map((stat, i) => (
            <div key={i} style={{ ...s.row, marginBottom: '0.5rem' }}>
              <input style={{ ...s.input, marginBottom: 0 }} placeholder="Label" value={stat.label}
                onChange={e => setHero(h => ({ ...h, stats: h.stats.map((st, j) => j === i ? { ...st, label: e.target.value } : st) }))} />
              <input style={{ ...s.input, marginBottom: 0 }} placeholder="Værdi" value={stat.value}
                onChange={e => setHero(h => ({ ...h, stats: h.stats.map((st, j) => j === i ? { ...st, value: e.target.value } : st) }))} />
            </div>
          ))}

          <SaveBar section="hero" status={statuses['hero'] ?? 'idle'} onSave={() => save('hero', hero)} />
        </>}

        {/* OM MIG */}
        {active === 'om' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Om mig</h1>

          {(['paragraph1', 'paragraph2', 'paragraph3'] as const).map((key, i) => (
            <div key={key}>
              <label style={s.label}>Afsnit {i + 1}</label>
              <textarea style={s.textarea} value={about[key]} onChange={e => setAbout(a => ({ ...a, [key]: e.target.value }))} />
            </div>
          ))}

          <label style={{ ...s.label, marginTop: '0.5rem' }}>Punkter (højre side)</label>
          {about.items.map((item, i) => (
            <div key={i} style={s.card}>
              <p style={s.cardLabel}>Punkt {i + 1}</p>
              <label style={s.label}>Ikon</label>
              <input style={s.input} value={item.icon}
                onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, icon: e.target.value } : it) }))} />
              <label style={s.label}>Titel</label>
              <input style={s.input} value={item.title}
                onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) }))} />
              <label style={s.label}>Beskrivelse</label>
              <textarea style={s.textarea} value={item.description}
                onChange={e => setAbout(a => ({ ...a, items: a.items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) }))} />
            </div>
          ))}

          <SaveBar section="about" status={statuses['about'] ?? 'idle'} onSave={() => save('about', about)} />
        </>}

        {/* ERFARING */}
        {active === 'erfaring' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Erfaring</h1>

          {exps.map((exp, i) => (
            <div key={exp.slug} style={s.card}>
              <p style={s.cardLabel}>{exp.org} — {exp.title}</p>
              <div style={{ ...s.row, marginBottom: '0' }}>
                <div>
                  <label style={s.label}>Periode</label>
                  <input style={s.input} value={exp.period}
                    onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, period: e.target.value } : x))} />
                </div>
                <div>
                  <label style={s.label}>Organisation</label>
                  <input style={s.input} value={exp.org}
                    onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, org: e.target.value } : x))} />
                </div>
              </div>
              <label style={s.label}>Jobtitel</label>
              <input style={s.input} value={exp.title}
                onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
              <label style={s.label}>Beskrivelse</label>
              <textarea style={s.textarea} value={exp.description}
                onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <div style={{ width: '100px' }}>
                <label style={s.label}>Rækkefølge</label>
                <input style={s.input} type="number" value={exp.order ?? 0}
                  onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, order: parseInt(e.target.value) || 0 } : x))} />
              </div>
            </div>
          ))}

          <SaveBar section="experience" status={statuses['experience'] ?? 'idle'} onSave={() => save('experience', { entries: exps })} />
        </>}

        {/* KOMPETENCER */}
        {active === 'kompetencer' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Kompetencer</h1>

          <label style={s.label}>Kompetencer</label>
          {skills.chips.map((chip, i) => (
            <div key={i} style={{ ...s.row, marginBottom: '0.5rem' }}>
              <input style={{ ...s.input, marginBottom: 0 }} placeholder="Kompetence" value={chip.name}
                onChange={e => setSkills(sk => ({ ...sk, chips: sk.chips.map((c, j) => j === i ? { ...c, name: e.target.value } : c) }))} />
              <input style={{ ...s.input, marginBottom: 0 }} placeholder="Kategori" value={chip.category}
                onChange={e => setSkills(sk => ({ ...sk, chips: sk.chips.map((c, j) => j === i ? { ...c, category: e.target.value } : c) }))} />
            </div>
          ))}

          <div style={{ marginTop: '2rem' }}>
            <label style={s.label}>Roskilde — titel</label>
            <input style={s.input} value={skills.roskildeTitle} onChange={e => setSkills(sk => ({ ...sk, roskildeTitle: e.target.value }))} />
            <label style={s.label}>Roskilde — undertitel</label>
            <input style={s.input} value={skills.roskildeSubtitle} onChange={e => setSkills(sk => ({ ...sk, roskildeSubtitle: e.target.value }))} />
            <label style={s.label}>Roskilde — badge</label>
            <input style={s.input} value={skills.roskildeBadge} onChange={e => setSkills(sk => ({ ...sk, roskildeBadge: e.target.value }))} />
          </div>

          <SaveBar section="skills" status={statuses['skills'] ?? 'idle'} onSave={() => save('skills', skills)} />
        </>}

        {/* KONTAKT */}
        {active === 'kontakt' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Kontakt</h1>

          <label style={s.label}>Overskrift</label>
          <input style={s.input} value={contact.heading} onChange={e => setContact(c => ({ ...c, heading: e.target.value }))} />

          <label style={s.label}>Beskrivelse</label>
          <textarea style={s.textarea} value={contact.description} onChange={e => setContact(c => ({ ...c, description: e.target.value }))} />

          <label style={s.label}>LinkedIn URL</label>
          <input style={s.input} value={contact.linkedinUrl} onChange={e => setContact(c => ({ ...c, linkedinUrl: e.target.value }))} />

          <label style={s.label}>Email</label>
          <input style={s.input} value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />

          <SaveBar section="contact" status={statuses['contact'] ?? 'idle'} onSave={() => save('contact', contact)} />
        </>}

      </main>
    </div>
  )
}
