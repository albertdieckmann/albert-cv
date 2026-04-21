'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'

interface StatItem { label: string; value: string }
interface HeroData { tag: string; description: string; ctaText: string; stats: StatItem[] }
interface AboutItem { icon: string; title: string; description: string }
interface AboutData { paragraph1: string; paragraph2: string; paragraph3: string; items: AboutItem[] }
interface ChipItem { name: string; category: string }
interface SkillsData { chips: ChipItem[] }
interface ContactData { heading: string; description: string; linkedinUrl: string; email: string }
interface ExpEntry { period: string; org: string; title: string; description: string; order?: number; slug: string }
interface GalleryImage { filename: string; caption: string; order?: number }
interface GalleryData { images: GalleryImage[] }

interface ProjectItem { title: string; description: string; href: string; tags?: string; live?: boolean; order?: number }

interface Props {
  hero: HeroData
  about: AboutData
  skills: SkillsData
  contact: ContactData
  experiences: ExpEntry[]
  gallery: GalleryData
  projects: ProjectItem[]
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
    borderLeftStyle: 'solid', borderLeftWidth: '2px',
    borderLeftColor: active ? '#c8f060' : 'transparent',
    color: active ? '#e8e8e0' : '#888880',
    fontSize: '0.85rem', cursor: 'pointer', border: 'none',
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
  row: { display: 'grid', gap: '0.75rem' } as React.CSSProperties,
  card: { background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '1.25rem', marginBottom: '1rem', position: 'relative' as const },
  cardLabel: { color: '#555550', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 1rem', fontFamily: 'monospace' } as React.CSSProperties,
  footer: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #1e1e1e' } as React.CSSProperties,
  btn: (loading: boolean): React.CSSProperties => ({ background: loading ? '#8aa840' : '#c8f060', color: '#0a0a0a', fontWeight: 700, border: 'none', padding: '0.65rem 1.5rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'monospace', fontSize: '0.85rem', letterSpacing: '0.03em' }),
  addBtn: { background: 'transparent', border: '1px dashed #2a2a2a', color: '#888880', padding: '0.6rem 1rem', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', marginBottom: '1rem', transition: 'all 0.15s' } as React.CSSProperties,
  removeBtn: { position: 'absolute' as const, top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', color: '#555550', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0.25rem', fontFamily: 'monospace' },
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

function slugify(str: string) {
  return str.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || `entry-${Date.now()}`
}

export default function AdminClient({ hero: h0, about: a0, skills: sk0, contact: c0, experiences: ex0, gallery: g0, projects: pr0 }: Props) {
  const { signOut } = useClerk()
  const [active, setActive] = useState('hero')
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [hero, setHero] = useState(h0)
  const [about, setAbout] = useState(a0)
  const [skills, setSkills] = useState(sk0)
  const [contact, setContact] = useState(c0)
  const [exps, setExps] = useState(ex0)
  const [gallery, setGallery] = useState(g0)
  const [projects, setProjects] = useState(pr0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle')

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')

    try {
      // Konverter til JPEG i browseren via canvas (håndterer HEIC, PNG, WebP osv.)
      const base64Jpeg = await convertToJpeg(file)
      const filename = `${Date.now()}-${file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-')}.jpg`

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, base64: base64Jpeg, contentType: 'image/jpeg' }),
      })

      if (res.ok) {
        const { filename: savedFilename } = await res.json() as { filename: string }
        const newImage = { filename: savedFilename, caption: '', order: gallery.images.length }
        const updatedGallery = { ...gallery, images: [...gallery.images, newImage] }
        setGallery(updatedGallery)

        const saveRes = await fetch('/api/admin/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'gallery', data: updatedGallery }),
        })
        setUploadStatus(saveRes.ok ? 'ok' : 'error')
        setTimeout(() => setUploadStatus('idle'), 3000)
      } else {
        setUploadStatus('error')
      }
    } catch (err) {
      console.error('Upload fejl:', err)
      setUploadStatus('error')
    }
  }

  async function convertToJpeg(file: File): Promise<string> {
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')

    let blob: Blob = file
    if (isHeic) {
      // heic2any dekoder HEIC i browseren uden OS-support (virker i Chrome på Mac)
      const heic2any = (await import('heic2any')).default
      blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.88 }) as Blob
    }

    const bitmap = await createImageBitmap(blob)

    const maxSize = 2400
    let { width, height } = bitmap
    if (width > maxSize || height > maxSize) {
      if (width > height) { height = Math.round(height * maxSize / width); width = maxSize }
      else { width = Math.round(width * maxSize / height); height = maxSize }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  const nav = [
    { key: 'hero', label: '🏠 Hero' },
    { key: 'projekter', label: '🚀 Projekter' },
    { key: 'om', label: '👤 Om mig' },
    { key: 'erfaring', label: '💼 Erfaring' },
    { key: 'kompetencer', label: '🧠 Kompetencer' },
    { key: 'kontakt', label: '✉️ Kontakt' },
    { key: 'galleri', label: '🖼️ Galleri' },
  ]

  return (
    <div style={s.wrap}>
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
            <div key={i} style={{ ...s.card, padding: '0.75rem 2.5rem 0.75rem 0.75rem' }}>
              <button style={s.removeBtn} title="Fjern" onClick={() => setHero(h => ({ ...h, stats: h.stats.filter((_, j) => j !== i) }))}>✕</button>
              <div style={{ ...s.row, gridTemplateColumns: '1fr 1fr' }}>
                <input style={{ ...s.input, marginBottom: 0 }} placeholder="Label" value={stat.label}
                  onChange={e => setHero(h => ({ ...h, stats: h.stats.map((st, j) => j === i ? { ...st, label: e.target.value } : st) }))} />
                <input style={{ ...s.input, marginBottom: 0 }} placeholder="Værdi" value={stat.value}
                  onChange={e => setHero(h => ({ ...h, stats: h.stats.map((st, j) => j === i ? { ...st, value: e.target.value } : st) }))} />
              </div>
            </div>
          ))}
          <button style={s.addBtn} onClick={() => setHero(h => ({ ...h, stats: [...h.stats, { label: '', value: '' }] }))}>
            + Tilføj stat
          </button>

          <SaveBar section="hero" status={statuses['hero'] ?? 'idle'} onSave={() => save('hero', hero)} />
        </>}

        {/* PROJEKTER */}
        {active === 'projekter' && <>
          <p style={s.sectionTitle}>Forside</p>
          <h1 style={s.sectionHeading}>Projekter</h1>

          {projects.map((p, i) => (
            <div key={i} style={s.card}>
              <button style={s.removeBtn} title="Fjern" onClick={() => setProjects(ps => ps.filter((_, j) => j !== i))}>✕</button>
              <p style={s.cardLabel}>{p.title || 'Nyt projekt'}</p>

              <label style={s.label}>Titel</label>
              <input style={s.input} value={p.title}
                onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />

              <label style={s.label}>Beskrivelse</label>
              <textarea style={s.textarea} value={p.description}
                onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />

              <label style={s.label}>Link (href) — lad stå tomt for placeholder</label>
              <input style={s.input} placeholder="/mit-projekt" value={p.href}
                onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, href: e.target.value } : x))} />

              <label style={s.label}>Tags (vises som fx &quot;Salling API · Next.js&quot;)</label>
              <input style={s.input} placeholder="API · Next.js" value={p.tags ?? ''}
                onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, tags: e.target.value } : x))} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '120px' }}>
                  <label style={s.label}>Rækkefølge</label>
                  <input style={{ ...s.input, marginBottom: 0 }} type="number" value={p.order ?? i}
                    onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, order: parseInt(e.target.value) || 0 } : x))} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.1rem' }}>
                  <input type="checkbox" checked={p.live ?? false}
                    onChange={e => setProjects(ps => ps.map((x, j) => j === i ? { ...x, live: e.target.checked } : x))} />
                  <span style={{ color: '#888880', fontSize: '0.75rem' }}>Vis &quot;● Live&quot; badge</span>
                </label>
              </div>
            </div>
          ))}

          <button style={s.addBtn} onClick={() => {
            const maxOrder = projects.reduce((m, p) => Math.max(m, p.order ?? 0), 0)
            setProjects(ps => [...ps, { title: '', description: '', href: '', tags: '', live: false, order: maxOrder + 1 }])
          }}>
            + Tilføj projekt
          </button>

          <SaveBar section="projects" status={statuses['projects'] ?? 'idle'} onSave={() => save('projects', { projects })} />
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
              <button style={s.removeBtn} title="Fjern" onClick={() => setAbout(a => ({ ...a, items: a.items.filter((_, j) => j !== i) }))}>✕</button>
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
          <button style={s.addBtn} onClick={() => setAbout(a => ({ ...a, items: [...a.items, { icon: '', title: '', description: '' }] }))}>
            + Tilføj punkt
          </button>

          <SaveBar section="about" status={statuses['about'] ?? 'idle'} onSave={() => save('about', about)} />
        </>}

        {/* ERFARING */}
        {active === 'erfaring' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Erfaring</h1>

          {exps.map((exp, i) => (
            <div key={exp.slug} style={s.card}>
              <button style={s.removeBtn} title="Fjern" onClick={() => setExps(xs => xs.filter((_, j) => j !== i))}>✕</button>
              <p style={s.cardLabel}>{exp.org || 'Ny post'} {exp.title ? `— ${exp.title}` : ''}</p>
              <div style={{ ...s.row, gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
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
              <div style={{ width: '120px' }}>
                <label style={s.label}>Rækkefølge</label>
                <input style={s.input} type="number" value={exp.order ?? 0}
                  onChange={e => setExps(xs => xs.map((x, j) => j === i ? { ...x, order: parseInt(e.target.value) || 0 } : x))} />
              </div>
            </div>
          ))}
          <button style={s.addBtn} onClick={() => {
            const maxOrder = exps.reduce((m, e) => Math.max(m, e.order ?? 0), 0)
            setExps(xs => [...xs, { period: '', org: '', title: '', description: '', order: maxOrder + 1, slug: `ny-${Date.now()}` }])
          }}>
            + Tilføj erfaring
          </button>

          <SaveBar section="experience" status={statuses['experience'] ?? 'idle'} onSave={() => {
            // Generer slugs for nye poster (dem der starter med 'ny-')
            const withSlugs = exps.map(e => ({
              ...e,
              slug: e.slug.startsWith('ny-') ? slugify(e.org + '-' + e.title) || e.slug : e.slug
            }))
            setExps(withSlugs)
            save('experience', { entries: withSlugs })
          }} />
        </>}

        {/* KOMPETENCER */}
        {active === 'kompetencer' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Kompetencer</h1>

          <label style={s.label}>Kompetencer</label>
          {skills.chips.map((chip, i) => (
            <div key={i} style={{ ...s.card, padding: '0.75rem 2.5rem 0.75rem 0.75rem' }}>
              <button style={s.removeBtn} title="Fjern" onClick={() => setSkills(sk => ({ ...sk, chips: sk.chips.filter((_, j) => j !== i) }))}>✕</button>
              <div style={{ ...s.row, gridTemplateColumns: '1fr 1fr' }}>
                <input style={{ ...s.input, marginBottom: 0 }} placeholder="Kompetence" value={chip.name}
                  onChange={e => setSkills(sk => ({ ...sk, chips: sk.chips.map((c, j) => j === i ? { ...c, name: e.target.value } : c) }))} />
                <input style={{ ...s.input, marginBottom: 0 }} placeholder="Kategori" value={chip.category}
                  onChange={e => setSkills(sk => ({ ...sk, chips: sk.chips.map((c, j) => j === i ? { ...c, category: e.target.value } : c) }))} />
              </div>
            </div>
          ))}
          <button style={s.addBtn} onClick={() => setSkills(sk => ({ ...sk, chips: [...sk.chips, { name: '', category: '' }] }))}>
            + Tilføj kompetence
          </button>

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

        {/* GALLERI */}
        {active === 'galleri' && <>
          <p style={s.sectionTitle}>Sektion</p>
          <h1 style={s.sectionHeading}>Galleri</h1>

          {/* Upload */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={s.label}>Upload billede</label>
            <input
              type="file"
              accept="image/*"
              style={{ ...s.input, padding: '0.4rem' }}
              onChange={handleImageUpload}
            />
            {uploadStatus === 'uploading' && <p style={{ color: '#888880', fontSize: '0.8rem' }}>Uploader...</p>}
            {uploadStatus === 'ok' && <p style={{ color: '#c8f060', fontSize: '0.8rem' }}>✓ Billede uploadet</p>}
            {uploadStatus === 'error' && <p style={{ color: '#ff6060', fontSize: '0.8rem' }}>Upload fejlede</p>}
          </div>

          {/* Eksisterende billeder */}
          {gallery.images.map((img, i) => (
            <div key={i} style={s.card}>
              <button style={s.removeBtn} onClick={() => setGallery(g => ({ ...g, images: g.images.filter((_, j) => j !== i) }))}>✕</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/gallery/${img.filename}`} alt={img.caption} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', marginBottom: '0.75rem' }} />
              <label style={s.label}>Billedtekst</label>
              <input style={s.input} value={img.caption}
                onChange={e => setGallery(g => ({ ...g, images: g.images.map((im, j) => j === i ? { ...im, caption: e.target.value } : im) }))} />
              <div style={{ width: '120px' }}>
                <label style={s.label}>Rækkefølge</label>
                <input style={s.input} type="number" value={img.order ?? i}
                  onChange={e => setGallery(g => ({ ...g, images: g.images.map((im, j) => j === i ? { ...im, order: parseInt(e.target.value) || 0 } : im) }))} />
              </div>
            </div>
          ))}

          <SaveBar section="gallery" status={statuses['gallery'] ?? 'idle'} onSave={() => save('gallery', gallery)} />
        </>}

      </main>
    </div>
  )
}
