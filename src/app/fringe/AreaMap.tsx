"use client";

import { MapContainer, Polygon, Tooltip, CircleMarker, Circle } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_LABELS } from "@/lib/fringe-area";
import type { Area } from "@/lib/fringe-area";

type AreaDef = {
  area: Area;
  coords: LatLngExpression[];
  color: string;
};

type Landmark = { label: string; pos: LatLngExpression; icon: string };

const LANDMARKS: Landmark[] = [
  { label: "Edinburgh Castle", pos: [55.9486, -3.2003], icon: "🏰" },
  { label: "Calton Hill",      pos: [55.9543, -3.1765], icon: "⛰" },
  { label: "Arthur's Seat",    pos: [55.9445, -3.1618], icon: "⛰" },
  { label: "Greyfriars Kirk",  pos: [55.9463, -3.1904], icon: "⛪" },
  { label: "Waverley Station", pos: [55.9521, -3.1888], icon: "🚂" },
  { label: "The Meadows",      pos: [55.9382, -3.1870], icon: "🌳" },
];

const AREAS: AreaDef[] = [
  {
    area: "new_town",
    color: "#2980b9",
    coords: [
      [55.9530, -3.2080],
      [55.9530, -3.1730],
      [55.9560, -3.1650],
      [55.9630, -3.1750],
      [55.9650, -3.2100],
      [55.9560, -3.2120],
    ],
  },
  {
    area: "old_town",
    color: "#e67e22",
    coords: [
      [55.9497, -3.2005],
      [55.9530, -3.1975],
      [55.9530, -3.1900],
      [55.9518, -3.1800],
      [55.9508, -3.1770],
      [55.9478, -3.1800],
      [55.9468, -3.1840],
      [55.9470, -3.1920],
      [55.9478, -3.1970],
      [55.9480, -3.2005],
    ],
  },
  {
    area: "cowgate_grassmarket",
    color: "#8e44ad",
    coords: [
      [55.9480, -3.2005],
      [55.9478, -3.1970],
      [55.9470, -3.1920],
      [55.9468, -3.1840],
      [55.9455, -3.1860],
      [55.9445, -3.1885],
      [55.9440, -3.1940],
      [55.9440, -3.2040],
      [55.9455, -3.2055],
      [55.9475, -3.2040],
    ],
  },
  {
    area: "pleasance",
    color: "#27ae60",
    coords: [
      [55.9518, -3.1800],
      [55.9520, -3.1730],
      [55.9480, -3.1700],
      [55.9415, -3.1720],
      [55.9415, -3.1855],
      [55.9455, -3.1860],
      [55.9468, -3.1840],
      [55.9478, -3.1800],
      [55.9508, -3.1770],
    ],
  },
  {
    area: "george_square",
    color: "#c0392b",
    coords: [
      [55.9455, -3.1860],
      [55.9415, -3.1855],
      [55.9405, -3.1880],
      [55.9405, -3.1980],
      [55.9420, -3.1990],
      [55.9440, -3.1940],
      [55.9445, -3.1885],
    ],
  },
  {
    area: "southside",
    color: "#16a085",
    coords: [
      [55.9420, -3.1990],
      [55.9405, -3.1980],
      [55.9405, -3.1880],
      [55.9415, -3.1855],
      [55.9415, -3.1720],
      [55.9310, -3.1680],
      [55.9290, -3.2020],
      [55.9370, -3.2050],
    ],
  },
];

export function AreaMap() {
  return (
    <MapContainer
      center={[55.948, -3.190]}
      zoom={14}
      style={{ height: 360, width: "100%", borderRadius: 10, zIndex: 0, background: "#13151a" }}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
    >
      {/* City boundary — dashed circle enclosing the Fringe footprint */}
      <Circle
        center={[55.948, -3.188]}
        radius={1750}
        pathOptions={{ color: "rgba(255,255,255,0.18)", fillOpacity: 0, weight: 1.5, dashArray: "6 6" }}
      />

      {AREAS.map(({ area, coords, color }) => (
        <Polygon
          key={area}
          positions={coords}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}
        >
          <Tooltip permanent direction="center" className="area-tooltip">
            {AREA_LABELS[area]}
          </Tooltip>
        </Polygon>
      ))}

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
  );
}
