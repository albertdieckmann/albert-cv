'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import type { Clearance, FoodWasteEntry, GeoState, Promotion } from './types'
import {
  brandColor, brandLabel, fmt, formatDate, formatDistance,
  haversineKm, nextOpening, productCategory, promoDiscount, promoLabel,
  promoNewPrice, savingsKr, sortScore, todayHours, urgencyColor, weekHours,
} from './utils'

/* ── Main component ─────────────────────────────────────── */
export default function MadspildPage() {
  const [zip, setZip] = useState('8000')
  const [inputZip, setInputZip] = useState('8000')
  const [data, setData] = useState<FoodWasteEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })
  const [usingGeo, setUsingGeo] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Promotions state
  const [promos, setPromos] = useState<Promotion[] | null>(null)
  const [promosExpanded, setPromosExpanded] = useState(false)
  const [promosLoading, setPromosLoading] = useState(false)

  function toggleStore(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Hent tilbudsvarer
  const fetchPromos = useCallback(async (z?: string) => {
    setPromosLoading(true)
    try {
      const params = z ? `?zip=${encodeURIComponent(z)}` : ''
      const res = await fetch(`/api/salling/promotions${params}`)
      const json = await res.json()
      if (res.ok) {
        setPromos(Array.isArray(json) ? json as Promotion[] : json?.items ?? json?.promotions ?? [])
      }
      // Stille fejl — promotions er add-on, ikke kritisk
    } catch { /* ignorér */ }
    finally { setPromosLoading(false) }
  }, [])

  const fetchByZip = useCallback(async (z: string) => {
    setLoading(true); setError(null); setUsingGeo(false)
    try {
      const res = await fetch(`/api/salling/food-waste?zip=${encodeURIComponent(z)}`)
      const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
      if (!res.ok) {
        const e = json as { error?: string; detail?: string }
        throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
      }
      setData(Array.isArray(json) ? json as FoodWasteEntry[] : [])
      setExpanded(new Set())
      setLastFetched(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }))
      fetchPromos(z)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally { setLoading(false) }
  }, [fetchPromos])

  const fetchByCoords = useCallback(async (lat: number, lng: number) => {
    setLoading(true); setError(null); setUsingGeo(true)
    try {
      const res = await fetch(`/api/salling/food-waste?lat=${lat}&lng=${lng}`)
      const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
      if (!res.ok) {
        const e = json as { error?: string; detail?: string }
        throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
      }
      const rawEntries = Array.isArray(json) ? json as FoodWasteEntry[] : []

      const entries = rawEntries.map(entry => {
        const c = entry.store.coordinates
        // Salling returnerer GeoJSON-format: [longitude, latitude]
        const storeLat = Array.isArray(c) ? c[1] : (c?.lat ?? c?.latitude)
        const storeLng = Array.isArray(c) ? c[0] : (c?.lng ?? c?.lon ?? c?.longitude)
        const dist = (storeLat != null && storeLng != null && isFinite(storeLat) && isFinite(storeLng))
          ? haversineKm(lat, lng, storeLat, storeLng)
          : undefined
        return { ...entry, distance: dist }
      })
      entries.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      setData(entries)
      setExpanded(new Set())
      setLastFetched(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }))
      fetchPromos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
      setUsingGeo(false)
    } finally { setLoading(false) }
  }, [fetchPromos])

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo({ status: 'denied', reason: 'Din browser understøtter ikke geolocation.' }); return
    }
    setGeo({ status: 'requesting' })
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeo({ status: 'granted', lat, lng })
        fetchByCoords(lat, lng)
      },
      err => {
        const reason = err.code === 1 ? 'Du afslog adgang til din placering.'
          : err.code === 2 ? 'Kunne ikke bestemme din placering.'
          : 'Timeout ved hentning af placering.'
        setGeo({ status: 'denied', reason })
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }, [fetchByCoords])

  useEffect(() => {
    if ('geolocation' in navigator) requestGeo()
    else fetchByZip(zip)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const clean = inputZip.trim().replace(/\D/g, '').slice(0, 4)
    if (clean.length === 4) { setZip(clean); fetchByZip(clean) }
  }

  const storesWithItems = (data ?? []).filter(e => (e.clearances ?? []).length > 0)
  const totalClearances = storesWithItems.reduce((s, e) => s + e.clearances.length, 0)

  // Gruppér tilbud på kategori
  const promosByCategory = (promos ?? []).reduce<Record<string, Promotion[]>>((acc, p) => {
    const cat = p.category ?? 'Øvrige tilbud'
    ;(acc[cat] ??= []).push(p)
    return acc
  }, {})
  const promoCategories = Object.keys(promosByCategory).sort()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-dm-mono, monospace)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
          <Link href="/" style={{ color: 'var(--muted)', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.05em', flexShrink: 0 }}>←</Link>
          <span style={{ color: 'var(--accent)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>Madspild</span>
        </div>
        <div className="madspild-header-right" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {geo.status === 'granted' && usingGeo && (
            <span className="madspild-geo-badge" style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Din placering
            </span>
          )}
          {lastFetched && <span style={{ color: 'var(--muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Opdateret {lastFetched}</span>}
          <ThemeToggle />
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Title */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 0.5rem' }}>
            Madspildsvarer hos Føtex, Netto og Bilka nær dig
          </p>
          <h1 style={{ fontFamily: 'var(--font-dm-serif, serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, margin: '0 0 0.75rem', lineHeight: 1.1 }}>
            Varer på <em>tilbud</em> inden<br />de udløber
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0, maxWidth: '500px', lineHeight: 1.6 }}>
            Et lille forsøg med madspildsvarer
          </p>
        </div>

        {/* Søg */}
        {(geo.status === 'denied' || !usingGeo) ? (
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Postnummer</label>
              <input type="text" inputMode="numeric" maxLength={4} value={inputZip} onChange={e => setInputZip(e.target.value)} placeholder="8000"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.65rem 1rem', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', width: '110px', letterSpacing: '0.1em' }} />
            </div>
            <button type="submit" disabled={loading} style={{ background: loading ? 'var(--accent)' : 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 700, border: 'none', padding: '0.65rem 1.25rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', height: '42px' }}>
              {loading ? 'Henter...' : 'Søg'}
            </button>
            {geo.status === 'granted' && (
              <button type="button" onClick={() => fetchByCoords((geo as { status: 'granted'; lat: number; lng: number }).lat, (geo as { status: 'granted'; lat: number; lng: number }).lng)} disabled={loading}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--accent)', padding: '0.65rem 1rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', height: '42px' }}>
                📍 Min placering
              </button>
            )}
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
            <button onClick={() => { if (geo.status === 'granted') fetchByCoords(geo.lat, geo.lng) }} disabled={loading}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
              ↻ {loading ? 'Opdaterer...' : 'Opdater'}
            </button>
            <span style={{ color: 'var(--bg3)' }}>·</span>
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Søg på postnummer:</span>
              <input type="text" inputMode="numeric" maxLength={4} value={inputZip} onChange={e => setInputZip(e.target.value)} placeholder="8000"
                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--muted)', padding: '0.1rem 0.25rem', fontFamily: 'inherit', fontSize: '0.72rem', outline: 'none', width: '48px', letterSpacing: '0.05em' }} />
              <button type="submit" disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', padding: 0 }}>→</button>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '1rem 1.25rem', color: '#ff6060', fontSize: '0.8rem', marginBottom: '2rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            <strong>Fejl:</strong> {error}
          </div>
        )}

        {loading && (
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 0' }}>
            {usingGeo ? 'Henter nærmeste butikker...' : `Henter varer i postnummer ${zip}...`}
          </div>
        )}

        {/* ── TILBUDSVARER (promotions) — øverst, mindre prominent ── */}
        {promos !== null && promos.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <button
              onClick={() => setPromosExpanded(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', background: 'transparent',
                border: '1px solid var(--border)',
                borderBottom: promosExpanded ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Tilbudsvarer</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{promos.length} tilbud · {promoCategories.length} kategorier</span>
                {promosLoading && <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>opdaterer...</span>}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', transform: promosExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
            </button>

            {promosExpanded && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '1rem' }}>
                {promoCategories.map(cat => (
                  <div key={cat} style={{ marginBottom: '1.25rem' }}>
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>{cat}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {promosByCategory[cat].map((p, i) => (
                        <PromoCard key={p.id ?? i} promo={p} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MADSPILD BUTIKKER ── */}
        {!loading && data !== null && (
          <>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg2)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <Stat value={storesWithItems.length} label="butikker" />
              <div style={{ width: '1px', background: 'var(--bg3)' }} />
              <Stat value={totalClearances} label="madspildsvarer" />
              <div style={{ width: '1px', background: 'var(--bg3)' }} />
              <Stat value={usingGeo ? '📍 din placering' : zip} label={usingGeo ? 'sorteret efter afstand' : 'postnummer'} />
            </div>

            {expanded.size === 0 && storesWithItems.length > 0 && (
              <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginBottom: '1rem' }}>
                Tryk på en butik for at se varerne
              </p>
            )}

            {storesWithItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.75rem' }}>🛒</p>
                <p style={{ fontSize: '0.875rem' }}>
                  {usingGeo ? 'Ingen madspildsvarer fundet i nærheden lige nu.' : `Ingen madspildsvarer fundet i postnummer ${zip} lige nu.`}
                </p>
              </div>
            )}

            {storesWithItems.map(entry => (
              <StoreSection
                key={entry.store.id}
                entry={entry}
                isExpanded={expanded.has(entry.store.id)}
                onToggle={() => toggleStore(entry.store.id)}
                storePromos={(promos ?? []).filter(p =>
                  !p.storeIds || p.storeIds.length === 0 || p.storeIds.includes(entry.store.id)
                )}
              />
            ))}
          </>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem 2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.7rem', marginTop: '4rem' }}>
        Data fra{' '}
        <a href="https://developer.sallinggroup.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Salling Group API</a>
        {' · '}
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>albertdieckmann.dk</Link>
      </footer>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <span style={{ color: 'var(--accent)', fontSize: '1.4rem', fontWeight: 700 }}>{value}</span>
      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.1rem' }}>{label}</span>
    </div>
  )
}

function StoreSection({ entry, isExpanded, onToggle, storePromos }: {
  entry: FoodWasteEntry
  isExpanded: boolean
  onToggle: () => void
  storePromos: Promotion[]
}) {
  const [spotExpanded, setSpotExpanded] = useState(false)
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const clearances = entry.clearances ?? []
  const sorted = [...clearances].sort((a, b) => {
    const sa = sortScore(a), sb = sortScore(b)
    if (sb.pct !== sa.pct) return sb.pct - sa.pct
    return sb.kr - sa.kr
  })
  const categories = [...new Set(sorted.map(c => productCategory(c.product)))].sort()
  const filtered = activeCategory ? sorted.filter(c => productCategory(c.product) === activeCategory) : sorted
  const hours = todayHours(entry.store.hours)
  const week = weekHours(entry.store.hours)
  const next = !hours?.isOpen ? nextOpening(entry.store.hours) : null
  const dist = entry.distance != null ? formatDistance(entry.distance) : null

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {/* Klikbar store-header */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1rem', background: 'var(--bg2)',
        border: '1px solid', borderColor: isExpanded ? 'var(--bg3)' : 'var(--bg3)',
        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ background: brandColor(entry.store.brand), color: 'var(--accent-fg)', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
          {brandLabel(entry.store.brand)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
            {entry.store.name ?? 'Ukendt butik'}
          </p>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: '#555550', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span>{[entry.store.address?.street, entry.store.address?.zip, entry.store.address?.city].filter(Boolean).join(' · ')}</span>
            {dist && <span style={{ color: '#888880' }}>· {dist}</span>}
            {hours && <span style={{ color: hours.isOpen ? '#B87B6E' : '#888880', fontWeight: hours.isOpen ? 600 : 400 }}>· {hours.label}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <span style={{ color: '#B87B6E', fontSize: '0.8rem', fontWeight: 700 }}>
            {clearances.length} vare{clearances.length !== 1 ? 'r' : ''}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
        </div>
      </button>

      {isExpanded && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none' }}>
          {/* Kategorifilter */}
          {categories.length > 1 && (
            <div style={{ padding: '0.625rem 0.875rem 0', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[null, ...categories].map(cat => {
                const isActive = activeCategory === cat
                const label = cat === null ? `Alle (${sorted.length})` : `${cat} (${sorted.filter(c => productCategory(c.product) === cat).length})`
                return (
                  <button
                    key={cat ?? '__all__'}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      fontSize: '0.62rem', padding: '0.2rem 0.6rem', border: '1px solid',
                      borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      background: isActive ? 'rgba(184,123,110,0.15)' : 'var(--bg2)',
                      color: isActive ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em',
                      borderRadius: '2px',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Madspildsvarer */}
          <div style={{ padding: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {filtered.map((clearance, idx) => (
              <ProductCard key={clearance.offer?.ean ?? idx} clearance={clearance} />
            ))}
          </div>

          {/* Åbningstider — collapsible */}
          {week.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', margin: '0 0.875rem 0.875rem', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setHoursExpanded(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', background: 'transparent',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  fontFamily: 'inherit', color: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Åbningstider</span>
                  {next && !hoursExpanded && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>· Åbner {next}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', transform: hoursExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
              </button>

              {hoursExpanded && (
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '0.6rem 0.75rem' }}>
                  {week.map(h => (
                    <div key={h.date} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.25rem 0',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: h.isToday ? 700 : 400,
                        color: h.isToday ? 'var(--text)' : 'var(--muted)',
                        minWidth: '2rem',
                      }}>
                        {h.dayLabel}
                        {h.isToday && <span style={{ color: '#B87B6E', fontSize: '0.55rem', marginLeft: '0.3rem' }}>i dag</span>}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        color: h.closed ? 'var(--muted)' : h.isToday ? (hours?.isOpen ? '#B87B6E' : 'var(--muted)') : 'var(--muted)',
                        fontWeight: h.isToday && hours?.isOpen ? 600 : 400,
                      }}>
                        {h.closed ? 'Lukket' : `${h.open}–${h.close}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spotvarer for butikken — collapsible, mindre prominent */}
          {storePromos.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', margin: '0 0.875rem 0.875rem', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setSpotExpanded(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', background: 'transparent',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  fontFamily: 'inherit', color: 'var(--muted)',
                }}
              >
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Spotvarer · {storePromos.length} tilbud
                </span>
                <span style={{ fontSize: '0.65rem', transform: spotExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
              </button>

              {spotExpanded && (
                <div style={{ padding: '0.75rem', border: '1px solid var(--border)', borderTop: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                  {storePromos.map((p, i) => (
                    <PromoCard key={p.id ?? i} promo={p} compact />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProductCard({ clearance }: { clearance: Clearance }) {
  const { offer, product } = clearance
  const urgency = urgencyColor(offer?.endTime)
  const discount = offer?.percentDiscount ?? offer?.discount
  const newPrice = offer?.newPrice ?? offer?.price
  const savings = savingsKr(clearance)
  const stockLabel = (offer?.stockUnit === 'each' || offer?.stockUnit === 'stk') ? 'stk' : (offer?.stockUnit ?? 'stk')

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.875rem', display: 'flex', gap: '0.75rem', position: 'relative' }}>
      {discount != null && (
        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#B87B6E', color: '#1F2124', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem' }}>
          -{discount}%
        </div>
      )}
      {product?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image} alt={product.description ?? ''} width={56} height={56}
          style={{ width: '56px', height: '56px', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: '3px' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <div style={{ width: '56px', height: '56px', background: '#2E3237', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🛒</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.3, paddingRight: discount != null ? '2.25rem' : '0' }}>
          {product?.description ?? 'Ukendt vare'}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#B87B6E' }}>{fmt(newPrice)} kr</span>
          {offer?.originalPrice != null && offer.originalPrice > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'line-through' }}>{fmt(offer.originalPrice)} kr</span>
          )}
          {savings > 0 && (
            <span style={{ fontSize: '0.62rem', color: 'var(--muted)', marginLeft: 'auto' }}>spar {fmt(savings)} kr</span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {offer?.endTime && (
            <span style={{ fontSize: '0.62rem', color: urgency, border: `1px solid ${urgency}33`, padding: '0.1rem 0.35rem', flexShrink: 0 }}>
              ⏱ {formatDate(offer.endTime)}
            </span>
          )}
          {offer?.stock != null && (
            <span style={{ fontSize: '0.62rem', color: 'var(--muted)', border: '1px solid var(--border)', padding: '0.1rem 0.35rem' }}>
              {offer.stock} {stockLabel} tilbage
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoCard({ promo, compact = false }: { promo: Promotion; compact?: boolean }) {
  const label = promoLabel(promo)
  const np = promoNewPrice(promo)
  const disc = promoDiscount(promo)

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid #1a1a1a', padding: compact ? '0.6rem' : '0.75rem', display: 'flex', gap: '0.5rem', position: 'relative' }}>
      {disc != null && (
        <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '0.55rem', fontWeight: 700, padding: '0.1rem 0.35rem' }}>
          -{disc}%
        </div>
      )}
      {promo.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={promo.image} alt={label} width={40} height={40}
          style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: '2px' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 0.3rem', fontSize: compact ? '0.7rem' : '0.75rem', color: 'var(--text)', lineHeight: 1.3, paddingRight: disc != null ? '2rem' : '0' }}>
          {label}
        </p>
        {np != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>{fmt(np)} kr</span>
            {promo.originalPrice != null && promo.originalPrice > 0 && (
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textDecoration: 'line-through' }}>{fmt(promo.originalPrice)} kr</span>
            )}
          </div>
        )}
        {promo.validTo && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.6rem', color: 'var(--muted)' }}>
            Gælder til {new Date(promo.validTo).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>
    </div>
  )
}
