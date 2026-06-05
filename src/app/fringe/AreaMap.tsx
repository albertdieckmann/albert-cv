"use client";

import { MapContainer, Polygon, CircleMarker, Tooltip, Circle } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_LABELS } from "@/lib/fringe-area";
import type { Area } from "@/lib/fringe-area";

// ── Types ────────────────────────────────────────────────────────────────────

type AreaDef     = { area: Area; coords: LatLngExpression[]; color: string };
type AreaLabel   = { area: Area; pos: LatLngExpression };
type Landmark    = { label: string; pos: LatLngExpression; icon: string };

// ── Landmarks ────────────────────────────────────────────────────────────────

const LANDMARKS: Landmark[] = [
  { label: "Edinburgh Castle", pos: [55.9486, -3.2003], icon: "🏰" },
  { label: "Calton Hill",      pos: [55.9543, -3.1765], icon: "⛰"  },
  { label: "Arthur's Seat",    pos: [55.9445, -3.1618], icon: "⛰"  },
  { label: "Greyfriars Kirk",  pos: [55.9463, -3.1904], icon: "⛪"  },
  { label: "Waverley Station", pos: [55.9521, -3.1888], icon: "🚂"  },
  { label: "The Meadows",      pos: [55.9382, -3.1870], icon: "🌳"  },
];

// ── Area partitition ─────────────────────────────────────────────────────────
//
// Six gap-free rectangles; adjacent polygons share exact edge coordinates so
// there are no cracks between them.  All extend beyond the dashed ring so the
// CSS circle clip sees only colour, never the dark background.
//
// Dividers (geographically meaningful):
//   lat 55.953  ≈ Princes Street         (New Town / Old Town)
//   lat 55.947  ≈ Cowgate / Victoria St  (Old Town south)
//   lat 55.940  ≈ Chambers Street        (Cowgate south)
//   lat 55.934  ≈ Meadows south edge     (George Sq / Southside)
//   lon -3.184  ≈ South Bridge / Nicolson St (east / west split)

const AREAS: AreaDef[] = [
  {
    area: "new_town",
    color: "#2980b9",
    // North of Princes Street — extends well past the circle N edge
    coords: [[55.953, -3.240], [55.953, -3.150], [55.970, -3.150], [55.970, -3.240]],
  },
  {
    area: "old_town",
    color: "#e67e22",
    // Royal Mile corridor: lat 55.947–55.953, west of South Bridge
    coords: [[55.953, -3.240], [55.953, -3.184], [55.947, -3.184], [55.947, -3.240]],
  },
  {
    area: "cowgate_grassmarket",
    color: "#8e44ad",
    // Cowgate / Grassmarket: lat 55.940–55.947, west of South Bridge
    coords: [[55.947, -3.240], [55.947, -3.184], [55.940, -3.184], [55.940, -3.240]],
  },
  {
    area: "pleasance",
    color: "#27ae60",
    // East of South Bridge: lat 55.934–55.953, extends to circle E edge
    coords: [[55.953, -3.184], [55.953, -3.150], [55.934, -3.150], [55.934, -3.184]],
  },
  {
    area: "george_square",
    color: "#c0392b",
    // George Sq / Meadows W: lat 55.934–55.940, west of South Bridge
    coords: [[55.940, -3.240], [55.940, -3.184], [55.934, -3.184], [55.934, -3.240]],
  },
  {
    area: "southside",
    color: "#16a085",
    // Bruntsfield / Newington: full width south of Meadows
    coords: [[55.934, -3.240], [55.934, -3.150], [55.920, -3.150], [55.920, -3.240]],
  },
];

// ── Area label positions ─────────────────────────────────────────────────────
//
// Placed manually so each label sits comfortably inside the 1 800 m dashed ring.
// (Polygon centroid-based tooltips fail when a polygon extends far outside the
// visible circle, pulling the label off-screen.)

const AREA_LABEL_POSITIONS: AreaLabel[] = [
  { area: "new_town",            pos: [55.9585, -3.197] },
  { area: "old_town",            pos: [55.9505, -3.211] },
  { area: "cowgate_grassmarket", pos: [55.9435, -3.211] },
  { area: "pleasance",           pos: [55.9440, -3.167] },
  { area: "george_square",       pos: [55.9370, -3.207] },
  { area: "southside",           pos: [55.9320, -3.192] },
];

// ── Component ────────────────────────────────────────────────────────────────

export function AreaMap() {
  return (
    // Outer div: square aspect-ratio + border-radius clips Leaflet canvas to circle
    <div style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden", background: "#13151a" }}>
      <MapContainer
        center={[55.947, -3.191]}
        zoom={13}
        style={{ height: "100%", width: "100%", background: "#13151a" }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Coloured area tiles — weight:0 so no stroke lines between zones */}
        {AREAS.map(({ area, coords, color }) => (
          <Polygon
            key={area}
            positions={coords}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.52, weight: 0 }}
          />
        ))}

        {/* Area name labels — invisible dot with permanent tooltip at chosen position */}
        {AREA_LABEL_POSITIONS.map(({ area, pos }) => (
          <CircleMarker
            key={`lbl-${area}`}
            center={pos}
            radius={1}
            pathOptions={{ opacity: 0, fillOpacity: 0 }}
          >
            <Tooltip permanent direction="center" className="area-tooltip">
              {AREA_LABELS[area]}
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Dashed ring — city boundary */}
        <Circle
          center={[55.947, -3.191]}
          radius={1800}
          pathOptions={{ color: "rgba(255,255,255,0.30)", fillOpacity: 0, weight: 1.5, dashArray: "6 6" }}
        />

        {/* Landmark pins */}
        {LANDMARKS.map(({ label, pos, icon }) => (
          <CircleMarker
            key={label}
            center={pos}
            radius={4}
            pathOptions={{ color: "#fff", fillColor: "#fff", fillOpacity: 0.9, weight: 1.5 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="landmark-tooltip">
              {icon} {label}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
