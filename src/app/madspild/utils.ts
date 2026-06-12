import type { Clearance, Product, Promotion, Store, StoreHours } from './types'

export function brandColor(brand?: string): string {
  const map: Record<string, string> = {
    netto: '#FFDE00', foetex: '#E4002B', bilka: '#00539B', basalt: '#5a3f8f',
  }
  return map[brand?.toLowerCase() ?? ''] ?? '#B87B6E'
}

export function brandLabel(brand?: string): string {
  const map: Record<string, string> = {
    netto: 'Netto', foetex: 'Føtex', bilka: 'Bilka', basalt: 'Basalt',
  }
  return map[brand?.toLowerCase() ?? ''] ?? (brand ?? 'Butik')
}

export function formatTime(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

export function formatDate(iso?: string): string {
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

export function urgencyColor(endTime?: string): string {
  if (!endTime) return '#888880'
  try {
    const hours = (new Date(endTime).getTime() - Date.now()) / 3_600_000
    if (hours < 2) return '#ff6060'
    if (hours < 6) return '#f0a020'
    return '#B87B6E'
  } catch { return '#888880' }
}

export function fmt(n?: number): string {
  if (n == null || isNaN(n)) return '--'
  return n.toFixed(2).replace('.', ',')
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export function formatDistance(km: number): string {
  if (!isFinite(km) || isNaN(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

// Udtrækker "HH:MM" fra enten "HH:MM" eller "2026-04-21T07:00:00"
export function extractHHMM(value?: string): string {
  if (!value) return ''
  if (value.includes('T')) {
    const t = new Date(value)
    return t.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  }
  return value.slice(0, 5)
}

// Minutter siden midnat fra enten "HH:MM" eller ISO
export function toMinutes(value?: string): number {
  if (!value) return 0
  if (value.includes('T')) {
    const d = new Date(value)
    return d.getHours() * 60 + d.getMinutes()
  }
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

const DA_DAYS = ['Sø', 'Ma', 'Ti', 'On', 'To', 'Fr', 'Lø']

export function todayHours(hours?: StoreHours[]): { label: string; isOpen: boolean } | null {
  if (!hours?.length) return null
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = hours.find(h => h.date === todayStr)
  if (!today) return null
  if (today.closed) return { label: 'Lukket i dag', isOpen: false }
  const openMin = toMinutes(today.open)
  const closeMin = toMinutes(today.close)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const isOpen = nowMin >= openMin && nowMin < closeMin
  const range = `${extractHHMM(today.open)}–${extractHHMM(today.close)}`
  return {
    label: isOpen ? `Åben ${range}` : nowMin < openMin ? `Åbner ${today.open}` : `Lukket (lukkede ${today.close})`,
    isOpen,
  }
}

export function weekHours(hours?: StoreHours[]): { date: string; dayLabel: string; open: string; close: string; closed: boolean; isToday: boolean }[] {
  if (!hours?.length) return []
  const todayStr = new Date().toISOString().slice(0, 10)
  return hours
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => {
      const d = new Date(h.date)
      return {
        date: h.date,
        dayLabel: DA_DAYS[d.getDay()],
        open: extractHHMM(h.open),
        close: extractHHMM(h.close),
        closed: h.closed,
        isToday: h.date === todayStr,
      }
    })
}

export function nextOpening(hours?: StoreHours[]): string | null {
  if (!hours?.length) return null
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const sorted = hours.slice().sort((a, b) => a.date.localeCompare(b.date))
  for (const h of sorted) {
    if (h.closed) continue
    if (h.date < todayStr) continue
    const openMin = toMinutes(h.open)
    if (h.date === todayStr && nowMin >= openMin) continue
    const d = new Date(h.date)
    const dayLabel = h.date === todayStr ? 'i dag' : DA_DAYS[d.getDay()]
    return `${dayLabel} kl. ${extractHHMM(h.open)}`
  }
  return null
}

const CATEGORY_KW: [string, string[]][] = [
  ['Mejeri & æg',   ['mælk', 'ost', 'yoghurt', 'fløde', 'smør', 'æg', 'kvark', 'cremefraiche', 'skyr', 'kefir']],
  ['Kød & fisk',    ['kød', 'fisk', 'kylling', 'laks', 'svin', 'okse', 'hakket', 'filet', 'rejer', 'tun', 'pølse', 'bacon', 'skank']],
  ['Frugt & grønt', ['frugt', 'grønt', 'salat', 'tomat', 'æble', 'banan', 'gulerod', 'løg', 'agurk', 'peber', 'spinat', 'broccoli']],
  ['Brød & bageri', ['brød', 'bolle', 'rugbrød', 'toast', 'kage', 'croissant', 'wienerbrød', 'baguette', 'muffin', 'tærte']],
  ['Drikkevarer',   ['juice', 'saft', 'smoothie', 'drik', 'lemonade']],
  ['Pålæg',         ['pålæg', 'skinke', 'salami', 'leverpostej', 'spegepølse', 'paté']],
  ['Færdigretter',  ['pizza', 'lasagne', 'suppe', 'sandwich', 'wrap', 'sushi', 'nuggets', 'frikadelle', 'falafel']],
]

function topCategory(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 1) return val.split('>')[0].trim()
  if (Array.isArray(val) && val.length > 0) return String(val[0]).split('>')[0].trim()
  return null
}

export function productCategory(product?: Product): string {
  if (product?.categories) {
    const cats = product.categories
    const direct = topCategory(cats)
    if (direct) return direct
    if (typeof cats === 'object' && !Array.isArray(cats)) {
      for (const val of Object.values(cats)) {
        const s = topCategory(val)
        if (s) return s
      }
    }
  }
  if (product?.description) {
    const lower = product.description.toLowerCase()
    for (const [cat, kws] of CATEGORY_KW) {
      if (kws.some(k => lower.includes(k))) return cat
    }
  }
  return 'Andet'
}

export function savingsKr(c: Clearance): number {
  const orig = c.offer?.originalPrice
  const curr = c.offer?.newPrice ?? c.offer?.price
  if (orig != null && orig > 0 && curr != null) return Math.max(0, orig - curr)
  return 0
}

export function sortScore(c: Clearance): { pct: number; kr: number } {
  return {
    pct: c.offer?.percentDiscount ?? c.offer?.discount ?? 0,
    kr: savingsKr(c),
  }
}

export function promoLabel(p: Promotion): string {
  return p.heading ?? p.title ?? p.name ?? p.description ?? 'Tilbud'
}

export function promoNewPrice(p: Promotion): number | undefined {
  return p.newPrice ?? p.price
}

export function promoDiscount(p: Promotion): number | undefined {
  if (p.percentDiscount) return p.percentDiscount
  const np = promoNewPrice(p)
  if (np != null && p.originalPrice && p.originalPrice > 0) {
    return Math.round((1 - np / p.originalPrice) * 100)
  }
  return undefined
}

export function extractCoords(store: Store): { lat: number; lng: number } | null {
  const c = store.coordinates
  if (!c) return null
  if (Array.isArray(c)) return { lat: c[1], lng: c[0] }
  const lat = c.lat ?? c.latitude
  const lng = c.lng ?? c.lon ?? c.longitude
  if (lat != null && lng != null) return { lat, lng }
  return null
}
