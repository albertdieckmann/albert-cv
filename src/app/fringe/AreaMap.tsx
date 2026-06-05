"use client";

import { MapContainer, TileLayer, Polygon, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_LABELS } from "@/lib/fringe-area";
import type { Area } from "@/lib/fringe-area";

type AreaDef = {
  area: Area;
  // Vertices roughly follow major streets / natural boundaries
  coords: LatLngExpression[];
  color: string;
};

// Coordinates are [lat, lon]. Key reference streets:
//   Princes Street:         lat ≈ 55.952 (E-W, N boundary of Old Town)
//   High Street/Royal Mile: lat ≈ 55.949–55.952 (ridge running E-W)
//   Cowgate:                lat ≈ 55.947 (parallel, south of Royal Mile)
//   South Bridge/Nicolson:  lon ≈ -3.185 (N-S, divides Old Town from Pleasance)
//   George IV Bridge:       lon ≈ -3.190 (N-S, between Old Town and Grassmarket)
//   The Meadows (N edge):   lat ≈ 55.941
const AREAS: AreaDef[] = [
  {
    area: "new_town",
    color: "#2980b9",
    // North of Princes Street — roughly bounded by Queensferry St (W),
    // Calton Hill (E) and the Water of Leith to the north.
    coords: [
      [55.9530, -3.2080], // W end of Princes St
      [55.9530, -3.1730], // E end of Princes St
      [55.9560, -3.1650], // Calton Hill / E boundary
      [55.9630, -3.1750], // NE
      [55.9650, -3.2100], // NW
      [55.9560, -3.2120], // Queensferry Rd area
    ],
  },
  {
    area: "old_town",
    color: "#e67e22",
    // The Royal Mile ridge — Castle down to Canongate / Holyrood.
    // Shaped like a herring-bone with the ridge running ENE.
    coords: [
      [55.9497, -3.2005], // Castle (SW)
      [55.9530, -3.1975], // Castle Esplanade (N) / Mound
      [55.9530, -3.1900], // North Bridge N end
      [55.9518, -3.1800], // Canongate mid-N
      [55.9508, -3.1770], // Holyrood / Canongate E
      [55.9478, -3.1800], // Holyrood Rd S
      [55.9468, -3.1840], // S Canongate
      [55.9470, -3.1920], // Cowgate mid (S boundary)
      [55.9478, -3.1970], // Victoria St / W Cowgate
      [55.9480, -3.2005], // Castle S wall
    ],
  },
  {
    area: "cowgate_grassmarket",
    color: "#8e44ad",
    // Cowgate corridor + Grassmarket bowl, south of the Royal Mile ridge.
    coords: [
      [55.9480, -3.2005], // Castle S / W
      [55.9478, -3.1970], // Victoria St top
      [55.9470, -3.1920], // Cowgate W junction
      [55.9468, -3.1840], // Cowgate E end
      [55.9455, -3.1860], // Chambers St / Bristo
      [55.9445, -3.1885], // SW Bristo Square
      [55.9440, -3.1940], // S boundary
      [55.9440, -3.2040], // Grassmarket SW
      [55.9455, -3.2055], // Grassmarket W (King's Stables Rd)
      [55.9475, -3.2040], // Back up toward Castle
    ],
  },
  {
    area: "pleasance",
    color: "#27ae60",
    // East of South Bridge / Nicolson Street, includes The Pleasance venue
    // and the area down to the east side of The Meadows.
    coords: [
      [55.9518, -3.1800], // N (Canongate mid)
      [55.9520, -3.1730], // NE corner
      [55.9480, -3.1700], // E boundary
      [55.9415, -3.1720], // SE Meadows
      [55.9415, -3.1855], // S / Meadows W edge
      [55.9455, -3.1860], // N Meadows / Chambers St
      [55.9468, -3.1840], // NW (Cowgate/Canongate join)
      [55.9478, -3.1800], // Holyrood Rd
      [55.9508, -3.1770], // Canongate E
    ],
  },
  {
    area: "george_square",
    color: "#c0392b",
    // George Square / Festival village / Bristo Square area.
    coords: [
      [55.9455, -3.1860], // N (Chambers St E)
      [55.9415, -3.1855], // NE (Meadows W edge)
      [55.9405, -3.1880], // SE
      [55.9405, -3.1980], // SW
      [55.9420, -3.1990], // W
      [55.9440, -3.1940], // NW
      [55.9445, -3.1885], // N boundary W
    ],
  },
  {
    area: "southside",
    color: "#16a085",
    // South of The Meadows — Newington, Marchmont and surrounds.
    coords: [
      [55.9420, -3.1990], // NW corner (Meadows S-W)
      [55.9405, -3.1980], // W
      [55.9405, -3.1880], // N-mid
      [55.9415, -3.1855], // NE Meadows corner
      [55.9415, -3.1720], // NE far
      [55.9310, -3.1680], // SE
      [55.9290, -3.2020], // SW
      [55.9370, -3.2050], // NW mid
    ],
  },
];

export function AreaMap() {
  return (
    <MapContainer
      center={[55.948, -3.190]}
      zoom={14}
      style={{ height: 360, width: "100%", borderRadius: 10, zIndex: 0 }}
      scrollWheelZoom={false}
    >
      {/* CartoDB Positron (no labels) — clean grey base, our polygons are the visual */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {AREAS.map(({ area, coords, color }) => (
        <Polygon
          key={area}
          positions={coords}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.42, weight: 2.5 }}
        >
          <Tooltip permanent direction="center" className="area-tooltip">
            {AREA_LABELS[area]}
          </Tooltip>
        </Polygon>
      ))}
    </MapContainer>
  );
}
