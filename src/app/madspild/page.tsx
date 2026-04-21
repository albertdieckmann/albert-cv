‘use client’

import { useState, useEffect, useCallback } from ‘react’
import Link from ‘next/link’

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

interface Store {
id: string
name?: string
brand?: string
address?: StoreAddress
coordinates?: { lat: number; lng: number }
}

interface FoodWasteEntry {
store: Store
clearances: Clearance[]
distance?: number // km – tilføjet client-side
}

type GeoState =
| { status: ‘idle’ }
| { status: ‘requesting’ }
| { status: ‘granted’; lat: number; lng: number }
| { status: ‘denied’; reason: string }

/* ── Helpers ────────────────────────────────────────────── */
function brandColor(brand?: string): string {
const map: Record<string, string> = {
netto: ‘#FFDE00’,
foetex: ‘#E4002B’,
bilka: ‘#00539B’,
basalt: ‘#5a3f8f’,
}
return map[brand?.toLowerCase() ?? ‘’] ?? ‘#c8f060’
}

function brandLabel(brand?: string): string {
const map: Record<string, string> = {
netto: ‘Netto’,
foetex: ‘Føtex’,
bilka: ‘Bilka’,
basalt: ‘Basalt’,
}
return map[brand?.toLowerCase() ?? ‘’] ?? (brand ?? ‘Butik’)
}

function formatTime(iso?: string): string {
if (!iso) return ‘’
try {
return new Date(iso).toLocaleTimeString(‘da-DK’, { hour: ‘2-digit’, minute: ‘2-digit’ })
} catch {
return ‘’
}
}

function formatDate(iso?: string): string {
if (!iso) return ‘ukendt tidspunkt’
try {
const d = new Date(iso)
const today = new Date()
const tomorrow = new Date(today)
tomorrow.setDate(today.getDate() + 1)
if (d.toDateString() === today.toDateString()) return `i dag kl. ${formatTime(iso)}`
if (d.toDateString() === tomorrow.toDateString()) return `i morgen kl. ${formatTime(iso)}`
return d.toLocaleDateString(‘da-DK’, { day: ‘numeric’, month: ‘short’ }) + ` kl. ${formatTime(iso)}`
} catch {
return iso
}
}

function urgencyColor(endTime?: string): string {
if (!endTime) return ‘#888880’
try {
const ms = new Date(endTime).getTime() - Date.now()
const hours = ms / 3_600_000
if (hours < 2) return ‘#ff6060’
if (hours < 6) return ‘#f0a020’
return ‘#c8f060’
} catch {
return ‘#888880’
}
}

function fmt(n?: number): string {
if (n == null || isNaN(n)) return ‘–’
return n.toFixed(2).replace(’.’, ‘,’)
}

// Haversine-formel – returnerer afstand i km
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
if (km < 1) return `${Math.round(km * 1000)} m`
return `${km.toFixed(1).replace('.', ',')} km`
}

/* ── Component ──────────────────────────────────────────── */
export default function MadspildPage() {
const [zip, setZip] = useState(‘8000’)
const [inputZip, setInputZip] = useState(‘8000’)
const [data, setData] = useState<FoodWasteEntry[] | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [lastFetched, setLastFetched] = useState<string | null>(null)
const [geo, setGeo] = useState<GeoState>({ status: ‘idle’ })
const [usingGeo, setUsingGeo] = useState(false)

/* ── Fetch by zip ── */
const fetchByZip = useCallback(async (z: string) => {
setLoading(true)
setError(null)
setUsingGeo(false)
try {
const res = await fetch(`/api/salling/food-waste?zip=${encodeURIComponent(z)}`)
const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
if (!res.ok) {
const e = json as { error?: string; detail?: string }
throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
}
setData(Array.isArray(json) ? json as FoodWasteEntry[] : [])
setLastFetched(new Date().toLocaleTimeString(‘da-DK’, { hour: ‘2-digit’, minute: ‘2-digit’ }))
} catch (e) {
setError(e instanceof Error ? e.message : ‘Ukendt fejl’)
} finally {
setLoading(false)
}
}, [])

/* ── Fetch by coordinates ── */
const fetchByCoords = useCallback(async (lat: number, lng: number) => {
setLoading(true)
setError(null)
setUsingGeo(true)
try {
const res = await fetch(`/api/salling/food-waste?lat=${lat}&lng=${lng}`)
const json = await res.json() as FoodWasteEntry[] | { error?: string; detail?: string }
if (!res.ok) {
const e = json as { error?: string; detail?: string }
throw new Error(e.error ? `${e.error}${e.detail ? `\n\n${e.detail}` : ''}` : `HTTP ${res.status}`)
}
const entries = (Array.isArray(json) ? json as FoodWasteEntry[] : []).map(entry => ({
…entry,
distance: entry.store.coordinates
? haversineKm(lat, lng, entry.store.coordinates.lat, entry.store.coordinates.lng)
: undefined,
}))
// Sortér nærmest først
entries.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
setData(entries)
setLastFetched(new Date().toLocaleTimeString(‘da-DK’, { hour: ‘2-digit’, minute: ‘2-digit’ }))
} catch (e) {
setError(e instanceof Error ? e.message : ‘Ukendt fejl’)
setUsingGeo(false)
} finally {
setLoading(false)
}
}, [])

/* ── Geolocation ── */
const requestGeo = useCallback(() => {
if (!navigator.geolocation) {
setGeo({ status: ‘denied’, reason: ‘Din browser understøtter ikke geolocation.’ })
return
}
setGeo({ status: ‘requesting’ })
navigator.geolocation.getCurrentPosition(
pos => {
const { latitude: lat, longitude: lng } = pos.coords
setGeo({ status: ‘granted’, lat, lng })
fetchByCoords(lat, lng)
},
err => {
const reason =
err.code === 1
? ‘Du afslog adgang til din placering.’
: err.code === 2
? ‘Kunne ikke bestemme din placering.’
: ‘Timeout ved hentning af placering.’
setGeo({ status: ‘denied’, reason })
},
{ timeout: 8000, maximumAge: 60_000 }
)
}, [fetchByCoords])

/* ── Auto-request geo on mount ── */
useEffect(() => {
if (‘geolocation’ in navigator) {
requestGeo()
} else {
fetchByZip(zip)
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

function handleSearch(e: React.FormEvent) {
e.preventDefault()
const clean = inputZip.trim().replace(/\D/g, ‘’).slice(0, 4)
if (clean.length === 4) {
setZip(clean)
fetchByZip(clean)
}
}

const storesWithItems = (data ?? []).filter(e => (e.clearances ?? []).length > 0)
const totalClearances = storesWithItems.reduce((s, e) => s + e.clearances.length, 0)

return (
<div style={{ minHeight: ‘100vh’, background: ‘#0a0a0a’, color: ‘#e8e8e0’, fontFamily: ‘var(–font-dm-mono, monospace)’ }}>

```
  {/* Header */}
  <header style={{ borderBottom: '1px solid #1e1e1e', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <Link href="/" style={{ color: '#888880', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.05em' }}>
        ← albertdieckmann.dk
      </Link>
      <span style={{ color: '#1e1e1e' }}>|</span>
      <span style={{ color: '#c8f060', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, fontWeight: 700 }}>
        Madspild
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      {/* Geo-status indikator */}
      {geo.status === 'granted' && usingGeo && (
        <span style={{ color: '#c8f060', fontSize: '0.65rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c8f060', display: 'inline-block' }} />
          Din placering
        </span>
      )}
      {lastFetched && (
        <span style={{ color: '#444440', fontSize: '0.7rem' }}>
          Opdateret {lastFetched}
        </span>
      )}
    </div>
  </header>

  <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 2rem' }}>

    {/* Title */}
    <div style={{ marginBottom: '2.5rem' }}>
      <p style={{ color: '#888880', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '0.15em', margin: '0 0 0.5rem' }}>
        Salling Group · Food Waste API
      </p>
      <h1 style={{ fontFamily: 'var(--font-dm-serif, serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, margin: '0 0 0.75rem', lineHeight: 1.1 }}>
        Varer på <em>tilbud</em> inden<br />de udløber
      </h1>
      <p style={{ color: '#888880', fontSize: '0.875rem', margin: 0, maxWidth: '500px', lineHeight: 1.6 }}>
        Salling Group åbner deres madspildsdata som et gratis API. Her kan du se hvilke varer der snart udløber i din nærmeste butik.
      </p>
    </div>

    {/* Geo-banner */}
    {geo.status === 'idle' || geo.status === 'requesting' ? (
      <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: '#888880', fontSize: '0.75rem' }}>
          {geo.status === 'requesting' ? '📍 Henter din placering…' : '📍 Henter placering…'}
        </span>
      </div>
    ) : geo.status === 'denied' ? (
      <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ color: '#888880', fontSize: '0.75rem' }}>
          📍 {geo.reason} Brug postnummer i stedet.
        </span>
        <button
          onClick={requestGeo}
          style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888880', padding: '0.35rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem' }}
        >
          Prøv igen
        </button>
      </div>
    ) : null}

    {/* Search */}
    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={{ display: 'block', color: '#666660', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
          Postnummer
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={inputZip}
          onChange={e => setInputZip(e.target.value)}
          placeholder="8000"
          style={{ background: '#111', border: '1px solid #222', color: '#e8e8e0', padding: '0.65rem 1rem', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', width: '110px', letterSpacing: '0.1em' }}
        />
      </div>
      <button type="submit" disabled={loading} style={{ background: loading ? '#8aa840' : '#c8f060', color: '#0a0a0a', fontWeight: 700, border: 'none', padding: '0.65rem 1.25rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', height: '42px' }}>
        {loading ? 'Henter...' : 'Søg'}
      </button>
      <button type="button" onClick={() => {
        if (geo.status === 'granted' && usingGeo) fetchByCoords(geo.lat, geo.lng)
        else fetchByZip(zip)
      }} disabled={loading} title="Opdater" style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888880', padding: '0.65rem 1rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', height: '42px' }}>
        ↻
      </button>
      {/* Geo-knap – vis kun hvis denied eller hvis brugeren søgte på postnummer */}
      {(geo.status === 'granted' && !usingGeo) && (
        <button
          type="button"
          onClick={() => fetchByCoords((geo as { status: 'granted'; lat: number; lng: number }).lat, (geo as { status: 'granted'; lat: number; lng: number }).lng)}
          disabled={loading}
          style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#c8f060', padding: '0.65rem 1rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', height: '42px', letterSpacing: '0.05em' }}
        >
          📍 Brug min placering
        </button>
      )}
    </form>

    {/* Error */}
    {error && (
      <div style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', padding: '1rem 1.25rem', color: '#ff6060', fontSize: '0.8rem', marginBottom: '2rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        <strong>Fejl:</strong> {error}
      </div>
    )}

    {/* Loading */}
    {loading && (
      <div style={{ color: '#888880', fontSize: '0.85rem', padding: '2rem 0' }}>
        {usingGeo ? 'Henter nærmeste butikker…' : `Henter varer i postnummer ${zip}…`}
      </div>
    )}

    {/* Results */}
    {!loading && data !== null && (
      <>
        {/* Summary */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', padding: '1rem 1.25rem', background: '#0f0f0f', border: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
          <Stat value={storesWithItems.length} label="butikker" />
          <div style={{ width: '1px', background: '#1e1e1e' }} />
          <Stat value={totalClearances} label="varer på tilbud" />
          <div style={{ width: '1px', background: '#1e1e1e' }} />
          <Stat value={usingGeo ? '📍 din placering' : zip} label={usingGeo ? 'sorteret efter afstand' : 'postnummer'} />
        </div>

        {storesWithItems.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#888880' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 0.75rem' }}>🛒</p>
            <p style={{ fontSize: '0.875rem' }}>
              {usingGeo
                ? 'Ingen madspildsvarer fundet i nærheden af dig lige nu.'
                : `Ingen madspildsvarer fundet i postnummer ${zip} lige nu.`}
            </p>
          </div>
        )}

        {storesWithItems.map(entry => (
          <StoreSection key={entry.store.id} entry={entry} />
        ))}
      </>
    )}
  </main>

  <footer style={{ borderTop: '1px solid #1e1e1e', padding: '1.5rem 2rem', textAlign: 'center', color: '#444440', fontSize: '0.7rem', marginTop: '4rem' }}>
    Data fra{' '}
    <a href="https://developer.sallinggroup.com" target="_blank" rel="noopener noreferrer" style={{ color: '#666660', textDecoration: 'none' }}>
      Salling Group Food Waste API
    </a>
    {' · '}Opdateres hvert 5. minut{' · '}
    <a href="/" style={{ color: '#666660', textDecoration: 'none' }}>albertdieckmann.dk</a>
  </footer>
</div>
```

)
}

/* ── Sub-components ─────────────────────────────────────── */
function Stat({ value, label }: { value: string | number; label: string }) {
return (
<div>
<span style={{ color: ‘#c8f060’, fontSize: ‘1.4rem’, fontWeight: 700 }}>{value}</span>
<span style={{ color: ‘#888880’, fontSize: ‘0.75rem’, display: ‘block’, marginTop: ‘0.1rem’ }}>{label}</span>
</div>
)
}

function StoreSection({ entry }: { entry: FoodWasteEntry }) {
const clearances = entry.clearances ?? []
const sorted = […clearances].sort((a, b) => {
const ta = a.offer?.endTime ? new Date(a.offer.endTime).getTime() : Infinity
const tb = b.offer?.endTime ? new Date(b.offer.endTime).getTime() : Infinity
return ta - tb
})

return (
<div style={{ marginBottom: ‘2.5rem’ }}>
{/* Store header */}
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: ‘0.75rem’, marginBottom: ‘1rem’, paddingBottom: ‘0.75rem’, borderBottom: ‘1px solid #1e1e1e’ }}>
<span style={{ background: brandColor(entry.store.brand), color: ‘#0a0a0a’, fontSize: ‘0.65rem’, fontWeight: 700, padding: ‘0.2rem 0.5rem’, letterSpacing: ‘0.08em’, textTransform: ‘uppercase’ as const, flexShrink: 0 }}>
{brandLabel(entry.store.brand)}
</span>
<div>
<p style={{ margin: 0, fontSize: ‘0.95rem’, fontWeight: 600, color: ‘#e8e8e0’ }}>{entry.store.name ?? ‘Ukendt butik’}</p>
<p style={{ margin: 0, fontSize: ‘0.72rem’, color: ‘#666660’ }}>
{[entry.store.address?.street, entry.store.address?.zip, entry.store.address?.city].filter(Boolean).join(’ · ’)}
{entry.distance != null && (
<span style={{ color: ‘#c8f060’, marginLeft: ‘0.5rem’ }}>· {formatDistance(entry.distance)}</span>
)}
</p>
</div>
<span style={{ marginLeft: ‘auto’, color: ‘#888880’, fontSize: ‘0.75rem’, flexShrink: 0 }}>
{clearances.length} vare{clearances.length !== 1 ? ‘r’ : ‘’}
</span>
</div>

```
  {/* Product grid */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
    {sorted.map((clearance, idx) => (
      <ProductCard key={clearance.offer?.ean ?? idx} clearance={clearance} />
    ))}
  </div>
</div>
```

)
}

function ProductCard({ clearance }: { clearance: Clearance }) {
const { offer, product } = clearance
const urgency = urgencyColor(offer?.endTime)
const discount = offer?.percentDiscount ?? offer?.discount
const newPrice = offer?.newPrice ?? offer?.price
const stockLabel = offer?.stockUnit === ‘each’ || offer?.stockUnit === ‘stk’
? ‘stk’
: (offer?.stockUnit ?? ‘stk’)

return (
<div style={{ background: ‘#0f0f0f’, border: ‘1px solid #1e1e1e’, padding: ‘1rem’, display: ‘flex’, gap: ‘0.875rem’, position: ‘relative’, overflow: ‘hidden’ }}>
{discount != null && (
<div style={{ position: ‘absolute’, top: ‘0.6rem’, right: ‘0.6rem’, background: ‘#c8f060’, color: ‘#0a0a0a’, fontSize: ‘0.65rem’, fontWeight: 700, padding: ‘0.15rem 0.4rem’ }}>
-{discount}%
</div>
)}

```
  {product?.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image}
      alt={product.description ?? ''}
      width={64}
      height={64}
      style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: '4px' }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div style={{ width: '64px', height: '64px', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🛒</div>
  )}

  <div style={{ flex: 1, minWidth: 0 }}>
    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#e8e8e0', lineHeight: 1.3, paddingRight: discount != null ? '2.5rem' : '0' }}>
      {product?.description ?? 'Ukendt vare'}
    </p>

    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c8f060' }}>
        {fmt(newPrice)} kr
      </span>
      {offer?.originalPrice != null && offer.originalPrice > 0 && (
        <span style={{ fontSize: '0.72rem', color: '#555550', textDecoration: 'line-through' }}>
          {fmt(offer.originalPrice)} kr
        </span>
      )}
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {offer?.endTime && (
        <span style={{ fontSize: '0.65rem', color: urgency, border: `1px solid ${urgency}33`, padding: '0.1rem 0.4rem', flexShrink: 0 }}>
          ⏱ Udløber {formatDate(offer.endTime)}
        </span>
      )}
      {offer?.stock != null && (
        <span style={{ fontSize: '0.65rem', color: '#888880', border: '1px solid #1e1e1e', padding: '0.1rem 0.4rem' }}>
          {offer.stock} {stockLabel} tilbage
        </span>
      )}
    </div>
  </div>
</div>
```

)
}
