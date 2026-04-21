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
  date: string      // 'YYYY-MM-DD'
  type: string
  open: string      // 'HH:MM'
  close: string     // 'HH:MM'
  closed: boolean
}

interface Store {
  id: string
  name?: string
  brand?: string
  address?: StoreAddress
  coordinates?: { lat?: number; lng?: number; lon?: number } // Salling bruger 'lon'
  hours?: StoreHours[]
}

interface FoodWasteEntry {
  store: Store
  clearances: Clearance[]
  distance?: number
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

// Returnerer { label, isOpen } for i dag — viser "Åben 08:00–21:00" eller "Åbner 08:00"
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

function savingsKr(c: Clearance): number {
  const orig = c.offer?.originalPrice ?? 0
  const curr = c.offer?.newPrice ?? c.offer?.price ?? orig
  return orig - curr
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

  function toggleStore(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const fetchByZip = useCallback(async (z: string) => {
    setLoading(true); setError(null); setUsingGeo(false)
    try {
      const res = await fetch(`/api/salling/food-waste?zip=${encodeURIComponent(z)}`)
      const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
      if (!res.ok) {
        const e = json as { error?: string; detail?: string }
        throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
      }
      const entries = Array.isArray(json) ? json as FoodWasteEntry[] : []
      setData(entries)
      setExpanded(new Set())
      setLastFetched(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally { setLoading(false) }
  }, [])

  const fetchByCoords = useCallback(async (lat: number, lng: number) => {
    setLoading(true); setError(null); setUsingGeo(true)
    try {
      const res = await fetch(`/api/salling/food-waste?lat=${lat}&lng=${lng}`)
      const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
      if (!res.ok) {
        const e = json as { error?: string; detail?: string }
        throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
      }
      const entries = (Array.isArray(json) ? json as FoodWasteEntry[] : []).map(entry => {
        const c = entry.store.coordinates
        const storeLng = c?.lng ?? c?.lon
        const dist = (c?.lat != null && storeLng != null)
          ? haversineKm(lat, lng, c.lat, storeLng)
          : undefined
        return { ...entry, distance: dist }
      })
      entries.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      setData(entries)
      setExpanded(new Set())
      setLastFetched(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
      setUsingGeo(false)
    } finally { setLoading(false) }
  }, [])

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

        {/* Søg — fremtrædende kun uden geo */}
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

        {/* Loading */}
        {loading && (
          <div style={{ color: '#888880', fontSize: '0.85rem', padding: '2rem 0' }}>
            {usingGeo ? 'Henter nærmeste butikker...' : `Henter varer i postnummer ${zip}...`}
          </div>
        )}

        {/* Results */}
        {!loading && data !== null && (
          <>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: '#0f0f0f', border: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
              <Stat value={storesWithItems.length} label="butikker" />
              <div style={{ width: '1px', background: '#1e1e1e' }} />
              <Stat value={totalClearances} label="varer på tilbud" />
              <div style={{ width: '1px', background: '#1e1e1e' }} />
              <Stat value={usingGeo ? '📍 din placering' : zip} label={usingGeo ? 'sorteret efter afstand' : 'postnummer'} />
            </div>

            {expanded.size === 0 && storesWithItems.length > 0 && (
              <p style={{ color: '#555550', fontSize: '0.72rem', marginBottom: '1.5rem' }}>
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
              />
            ))}
          </>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #1e1e1e', padding: '1.5rem 2rem', textAlign: 'center', color: '#444440', fontSize: '0.7rem', marginTop: '4rem' }}>
        Data fra{' '}
        <a href="https://developer.sallinggroup.com" target="_blank" rel="noopener noreferrer" style={{ color: '#666660', textDecoration: 'none' }}>Salling Group Food Waste API</a>
        {' · '}Opdateres hvert 5. minut{' · '}
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

function StoreSection({ entry, isExpanded, onToggle }: { entry: FoodWasteEntry; isExpanded: boolean; onToggle: () => void }) {
  const clearances = entry.clearances ?? []

  // Sortér: størst besparelse (kr) først
  const sorted = [...clearances].sort((a, b) => savingsKr(b) - savingsKr(a))

  const hours = todayHours(entry.store.hours)
  const dist = entry.distance != null ? formatDistance(entry.distance) : null

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {/* Klikbar store-header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1rem', background: '#0f0f0f',
          border: '1px solid', borderColor: isExpanded ? '#2a2a2a' : '#1e1e1e',
          borderBottom: isExpanded ? 'none' : '1px solid #1e1e1e',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {/* Brand badge */}
        <span style={{ background: brandColor(entry.store.brand), color: '#0a0a0a', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
          {brandLabel(entry.store.brand)}
        </span>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#e8e8e0' }}>
            {entry.store.name ?? 'Ukendt butik'}
          </p>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: '#555550', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span>{[entry.store.address?.street, entry.store.address?.zip, entry.store.address?.city].filter(Boolean).join(' · ')}</span>
            {dist && <span style={{ color: '#888880' }}>· {dist}</span>}
            {hours && (
              <span style={{ color: hours.isOpen ? '#c8f060' : '#888880', fontWeight: hours.isOpen ? 600 : 400 }}>
                · {hours.label}
              </span>
            )}
          </p>
        </div>

        {/* Count + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <span style={{ color: '#c8f060', fontSize: '0.8rem', fontWeight: 700 }}>
            {clearances.length} vare{clearances.length !== 1 ? 'r' : ''}
          </span>
          <span style={{ color: '#555550', fontSize: '0.75rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
        </div>
      </button>

      {/* Produkt-grid — kun når åbnet */}
      {isExpanded && (
        <div style={{ border: '1px solid #2a2a2a', borderTop: 'none', padding: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {sorted.map((clearance, idx) => (
            <ProductCard key={clearance.offer?.ean ?? idx} clearance={clearance} />
          ))}
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
            <span style={{ fontSize: '0.65rem', color: '#888880', marginLeft: 'auto' }}>spar {fmt(savings)} kr</span>
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
