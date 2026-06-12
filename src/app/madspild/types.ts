export interface Offer {
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

export interface Product {
  description?: string
  ean?: string
  image?: string
  categories?: Record<string, string[]> | string[] | string
}

export interface Clearance {
  offer: Offer
  product: Product
}

export interface StoreAddress {
  city?: string
  country?: string
  street?: string
  zip?: string
}

export interface StoreHours {
  date: string
  type: string
  open: string
  close: string
  closed: boolean
}

export interface Store {
  id: string
  name?: string
  brand?: string
  address?: StoreAddress
  // Salling returnerer [longitude, latitude] (GeoJSON-format)
  coordinates?: [number, number] | { lat?: number; lng?: number; lon?: number; latitude?: number; longitude?: number }
  hours?: StoreHours[]
}

export interface FoodWasteEntry {
  store: Store
  clearances: Clearance[]
  distance?: number
}

// Tilbudsvarer / spotvarer fra promotions-API
export interface Promotion {
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

export type GeoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'granted'; lat: number; lng: number }
  | { status: 'denied'; reason: string }
