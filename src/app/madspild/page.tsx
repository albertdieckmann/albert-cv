'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/* ── Types ──────────────────────────────────────────────── */
interface Offer {
  ean?: string
  currency?: string
  price?: number
  newPrice?: number
  originalPrice?: number
  discount?: number
  percentDiscount?: number
  startTime?: string
  endTime?: string
  stock?: number
  stockUnit?: string
  lastUpdate?: string
}

interface Product {
  description?: string
  ean?: string
  image?: string
}

interface Clearance {
  offer: Offer
  product: Product
}

interface StoreAddress {
  city?: string
  country?: string
  street?: string
  zip?: string
}

interface StoreHours {
  date: string
  type: string
  open: string
  close: string
  closed: boolean
}

interface Store {
  id: string
  name?: string
  brand?: string
  address?: StoreAddress
  // Salling returnerer [longitude, latitude] (GeoJSON-format)
  coordinates?: [number, number] | { lat?: number; lng?: number; lon?: number; latitude?: number; longitude?: number }
  hours?: StoreHours[]
}

interface FoodWasteEntry {
  store: Store
  clearances: Clearance[]
  distance?: number
}

// Tilbudsvarer / spotvarer fra promotions-API
interface Promotion {
  id?: string
  heading?: string
  description?: string
  category?: string
  price?: number
  originalPrice?: number
  percentDiscount?: number
  image?: string
  validFrom?: string
  validTo?: string
  storeIds?: string[]
  // Salling bruger muligvis andre feltnavne — begge håndteres
  name?: string
  title?: string
  newPrice?: number
}

type GeoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'granted'; lat: number; lng: number }
  | { status: 'denied'; reason: string }

/* ── Helpers ────────────────────────────────────────────── */
function brandColor(brand?: string): string {
  const map: Record<string, string> = {
    netto: '#FFDE00', foetex: '#E4002B', bilka: '#00539B', basalt: '#5a3f8f',
  }
  return map[brand?.toLowerCase() ?? ''] ?? '#c8f060'
}

function brandLabel(brand?: string): string {
  const map: Record<string, string> = {
    netto: 'Netto', foetex: 'Føtex', bilka: 'Bilka', basalt: 'Basalt',
  }
  return map[brand?.toLowerCase() ?? ''] ?? (brand ?? 'Butik')
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function formatDate(iso?: string): string {
  if (!iso) return 'ukendt tidspunkt'
  try {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return `i dag kl. ${formatTime(iso)}`
    if (d.toDateString() === tomorrow.toDateString()) return `i morgen kl. ${formatTime(iso)}`
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ` kl. ${formatTime(iso)}`
  } catch { return iso }
}

function urgencyColor(endTime?: string): string {
  if (!endTime) return '#888880'
  try {
    const hours = (new Date(endTime).getTime() - Date.now()) / 3_600_000
    if (hours < 2) return '#ff6060'
    if (hours < 6) return '#f0a020'
    return '#c8f060'
  } catch { return '#888880' }
}

function fmt(n?: number): string {
  if (n == null || isNaN(n)) return '--'
  return n.toFixed(2).replace('.', ',')
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  if (!isFinite(km) || isNaN(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

function todayHours(hours?: StoreHours[]): { label: string; isOpen: boolean } | null {
  if (!hours?.length) return null
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = hours.find(h => h.date === todayStr)
  if (!today) return null
  if (today.closed) return { label: 'Lukket i dag', isOpen: false }
  const [oh, om] = today.open.split(':').map(Number)
  const [ch, cm] = today.close.split(':').map(Number)
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const isOpen = nowMin >= openMin && nowMin < closeMin
  const range = `${today.open}–${today.close}`
  return {
    label: isOpen ? `Åben ${range}` : nowMin < openMin ? `Åbner ${today.open}` : `Lukket (lukkede ${today.close})`,
    isOpen,
  }
}

// Absolut besparelse i kr — kun når begge priser er kendte
function savingsKr(c: Clearance): number {
  const orig = c.offer?.originalPrice
  const curr = c.offer?.newPrice ?? c.offer?.price
  if (orig != null && orig > 0 && curr != null) return Math.max(0, orig - curr)
  return 0
}

// Sortéringsværdi: % rabat primær (altid til stede), kr sekundær
function sortScore(c: Clearance): { pct: number; kr: number } {
  return {
    pct: c.offer?.percentDiscount ?? c.offer?.discount ?? 0,
    kr: savingsKr(c),
  }
}

function promoLabel(p: Promotion): string {
  return p.heading ?? p.title ?? p.name ?? p.description ?? 'Tilbud'
}

function promoNewPrice(p: Promotion): number | undefined {
  return p.newPrice ?? p.price
}

function promoDiscount(p: Promotion): number | undefined {
  if (p.percentDiscount) return p.percentDiscount
  const np = promoNewPrice(p)
  if (np != null && p.originalPrice && p.originalPrice > 0) {
    return Math.round((1 - np / p.originalPrice) * 100)
  }
  return undefined
}

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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e8e0', fontFamily: 'var(--font-dm-mono, monospace)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #1e1e1e', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/" style={{ color: '#888880', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.05em' }}>← albertdieckmann.dk</Link>
          <span style={{ color: '#1e1e1e' }}>|</span>
          <span style={{ color: '#c8f060', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>Madspild</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {geo.status === 'granted' && usingGeo && (
            <span style={{ color: '#c8f060', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c8f060', display: 'inline-block' }} />
              Din placering
            </span>
          )}
          {lastFetched && <span style={{ color: '#444440', fontSize: '0.7rem' }}>Opdateret {lastFetched}</span>}
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Title */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ color: '#888880', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 0.5rem' }}>
            Salling Group · Food Waste API
          </p>
          <h1 style={{ fontFamily: 'var(--font-dm-serif, serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, margin: '0 0 0.75rem', lineHeight: 1.1 }}>
            Varer på <em>tilbud</em> inden<br />de udløber
          </h1>
          <p style={{ color: '#888880', fontSize: '0.875rem', margin: 0, maxWidth: '500px', lineHeight: 1.6 }}>
            Salling Group åbner deres madspildsdata som et gratis API. Her kan du se hvilke varer der snart udløber i din nærmeste butik.
          </p>
        </div>

        {/* Søg */}
        {(geo.status === 'denied' || !usingGeo) ? (
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', color: '#666660', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Postnummer</label>
              <input type="text" inputMode="numeric" maxLength={4} value={inputZip} onChange={e => setInputZip(e.target.value)} placeholder="8000"
                style={{ background: '#111', border: '1px solid #222', color: '#e8e8e0', padding: '0.65rem 1rem', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', width: '110px', letterSpacing: '0.1em' }} />
            </div>
            <button type="submit" disabled={loading} style={{ background: loading ? '#8aa840' : '#c8f060', color: '#0a0a0a', fontWeight: 700, border: 'none', padding: '0.65rem 1.25rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', height: '42px' }}>
              {loading ? 'Henter...' : 'Søg'}
            </button>
            {geo.status === 'granted' && (
              <button type="button" onClick={() => fetchByCoords((geo as { status: 'granted'; lat: number; lng: number }).lat, (geo as { status: 'granted'; lat: number; lng: number }).lng)} disabled={loading}
                style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#c8f060', padding: '0.65rem 1rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', height: '42px' }}>
                📍 Min placering
              </button>
            )}
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
            <button onClick={() => { if (geo.status === 'granted') fetchByCoords(geo.lat, geo.lng) }} disabled={loading}
              style={{ background: 'transparent', border: 'none', color: '#888880', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
              ↻ {loading ? 'Opdaterer...' : 'Opdater'}
            </button>
            <span style={{ color: '#1e1e1e' }}>·</span>
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#555550', fontSize: '0.72rem' }}>Søg på postnummer:</span>
              <input type="text" inputMode="numeric" maxLength={4} value={inputZip} onChange={e => setInputZip(e.target.value)} placeholder="8000"
                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #2a2a2a', color: '#888880', padding: '0.1rem 0.25rem', fontFamily: 'inherit', fontSize: '0.72rem', outline: 'none', width: '48px', letterSpacing: '0.05em' }} />
              <button type="submit" disabled={loading} style={{ background: 'none', border: 'none', color: '#555550', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', padding: 0 }}>→</button>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', padding: '1rem 1.25rem', color: '#ff6060', fontSize: '0.8rem', marginBottom: '2rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            <strong>Fejl:</strong> {error}
          </div>
        )}

        {loading && (
          <div style={{ color: '#888880', fontSize: '0.85rem', padding: '2rem 0' }}>
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
                border: '1px solid #1e1e1e',
                borderBottom: promosExpanded ? 'none' : '1px solid #1e1e1e',
                cursor: 'pointer', fontFamily: 'inherit', color: '#888880',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555550' }}>Tilbudsvarer</span>
                <span style={{ fontSize: '0.68rem', color: '#444440' }}>{promos.length} tilbud · {promoCategories.length} kategorier</span>
                {promosLoading && <span style={{ fontSize: '0.65rem', color: '#444440' }}>opdaterer...</span>}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#333330', transform: promosExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
            </button>

            {promosExpanded && (
              <div style={{ border: '1px solid #1e1e1e', borderTop: 'none', padding: '1rem' }}>
                {promoCategories.map(cat => (
                  <div key={cat} style={{ marginBottom: '1.25rem' }}>
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#444440' }}>{cat}</p>
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
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: '#0f0f0f', border: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
              <Stat value={storesWithItems.length} label="butikker" />
              <div style={{ width: '1px', background: '#1e1e1e' }} />
              <Stat value={totalClearances} label="madspildsvarer" />
              <div style={{ width: '1px', background: '#1e1e1e' }} />
              <Stat value={usingGeo ? '📍 din placering' : zip} label={usingGeo ? 'sorteret efter afstand' : 'postnummer'} />
            </div>

            {expanded.size === 0 && storesWithItems.length > 0 && (
              <p style={{ color: '#555550', fontSize: '0.72rem', marginBottom: '1rem' }}>
                Tryk på en butik for at se varerne
              </p>
            )}

            {storesWithItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#888880' }}>
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

      <footer style={{ borderTop: '1px solid #1e1e1e', padding: '1.5rem 2rem', textAlign: 'center', color: '#444440', fontSize: '0.7rem', marginTop: '4rem' }}>
        Data fra{' '}
        <a href="https://developer.sallinggroup.com" target="_blank" rel="noopener noreferrer" style={{ color: '#666660', textDecoration: 'none' }}>Salling Group API</a>
        {' · '}
        <a href="/" style={{ color: '#666660', textDecoration: 'none' }}>albertdieckmann.dk</a>
      </footer>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <span style={{ color: '#c8f060', fontSize: '1.4rem', fontWeight: 700 }}>{value}</span>
      <span style={{ color: '#888880', fontSize: '0.75rem', display: 'block', marginTop: '0.1rem' }}>{label}</span>
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
  const clearances = entry.clearances ?? []
  const sorted = [...clearances].sort((a, b) => {
    const sa = sortScore(a), sb = sortScore(b)
    if (sb.pct !== sa.pct) return sb.pct - sa.pct   // størst % rabat først
    return sb.kr - sa.kr                              // tiebreaker: størst kr-besparelse
  })
  const hours = todayHours(entry.store.hours)
  const dist = entry.distance != null ? formatDistance(entry.distance) : null

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {/* Klikbar store-header */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1rem', background: '#0f0f0f',
        border: '1px solid', borderColor: isExpanded ? '#2a2a2a' : '#1e1e1e',
        borderBottom: isExpanded ? 'none' : '1px solid #1e1e1e',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ background: brandColor(entry.store.brand), color: '#0a0a0a', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
          {brandLabel(entry.store.brand)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#e8e8e0' }}>
            {entry.store.name ?? 'Ukendt butik'}
          </p>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: '#555550', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span>{[entry.store.address?.street, entry.store.address?.zip, entry.store.address?.city].filter(Boolean).join(' · ')}</span>
            {dist && <span style={{ color: '#888880' }}>· {dist}</span>}
            {hours && <span style={{ color: hours.isOpen ? '#c8f060' : '#888880', fontWeight: hours.isOpen ? 600 : 400 }}>· {hours.label}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <span style={{ color: '#c8f060', fontSize: '0.8rem', fontWeight: 700 }}>
            {clearances.length} vare{clearances.length !== 1 ? 'r' : ''}
          </span>
          <span style={{ color: '#555550', fontSize: '0.75rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
        </div>
      </button>

      {isExpanded && (
        <div style={{ border: '1px solid #2a2a2a', borderTop: 'none' }}>
          {/* Madspildsvarer */}
          <div style={{ padding: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {sorted.map((clearance, idx) => (
              <ProductCard key={clearance.offer?.ean ?? idx} clearance={clearance} />
            ))}
          </div>

          {/* Spotvarer for butikken — collapsible, mindre prominent */}
          {storePromos.length > 0 && (
            <div style={{ borderTop: '1px solid #1e1e1e', margin: '0 0.875rem 0.875rem', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setSpotExpanded(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', background: 'transparent',
                  border: '1px solid #1e1e1e', cursor: 'pointer',
                  fontFamily: 'inherit', color: '#555550',
                }}
              >
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Spotvarer · {storePromos.length} tilbud
                </span>
                <span style={{ fontSize: '0.65rem', transform: spotExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
              </button>

              {spotExpanded && (
                <div style={{ padding: '0.75rem', border: '1px solid #1e1e1e', borderTop: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
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
    <div style={{ background: '#111', border: '1px solid #1e1e1e', padding: '0.875rem', display: 'flex', gap: '0.75rem', position: 'relative' }}>
      {discount != null && (
        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#c8f060', color: '#0a0a0a', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem' }}>
          -{discount}%
        </div>
      )}
      {product?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image} alt={product.description ?? ''} width={56} height={56}
          style={{ width: '56px', height: '56px', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: '3px' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <div style={{ width: '56px', height: '56px', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🛒</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#e8e8e0', lineHeight: 1.3, paddingRight: discount != null ? '2.25rem' : '0' }}>
          {product?.description ?? 'Ukendt vare'}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#c8f060' }}>{fmt(newPrice)} kr</span>
          {offer?.originalPrice != null && offer.originalPrice > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#555550', textDecoration: 'line-through' }}>{fmt(offer.originalPrice)} kr</span>
          )}
          {savings > 0 && (
            <span style={{ fontSize: '0.62rem', color: '#888880', marginLeft: 'auto' }}>spar {fmt(savings)} kr</span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {offer?.endTime && (
            <span style={{ fontSize: '0.62rem', color: urgency, border: `1px solid ${urgency}33`, padding: '0.1rem 0.35rem', flexShrink: 0 }}>
              ⏱ {formatDate(offer.endTime)}
            </span>
          )}
          {offer?.stock != null && (
            <span style={{ fontSize: '0.62rem', color: '#666660', border: '1px solid #1e1e1e', padding: '0.1rem 0.35rem' }}>
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
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', padding: compact ? '0.6rem' : '0.75rem', display: 'flex', gap: '0.5rem', position: 'relative' }}>
      {disc != null && (
        <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: '#2a2a2a', color: '#888880', fontSize: '0.55rem', fontWeight: 700, padding: '0.1rem 0.35rem' }}>
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
        <p style={{ margin: '0 0 0.3rem', fontSize: compact ? '0.7rem' : '0.75rem', color: '#aaa8a0', lineHeight: 1.3, paddingRight: disc != null ? '2rem' : '0' }}>
          {label}
        </p>
        {np != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#888880' }}>{fmt(np)} kr</span>
            {promo.originalPrice != null && promo.originalPrice > 0 && (
              <span style={{ fontSize: '0.65rem', color: '#444440', textDecoration: 'line-through' }}>{fmt(promo.originalPrice)} kr</span>
            )}
          </div>
        )}
        {promo.validTo && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.6rem', color: '#444440' }}>
            Gælder til {new Date(promo.validTo).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>
    </div>
  )
}
