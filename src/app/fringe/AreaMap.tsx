"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Rectangle, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_LABELS } from "@/lib/fringe-area";
import type { Area } from "@/lib/fringe-area";

type AreaDef = {
  area: Area;
  bounds: LatLngBoundsExpression;
  color: string;
};

const AREAS: AreaDef[] = [
  {
    area: "old_town",
    bounds: [[55.949, -3.200], [55.953, -3.175]],
    color: "#e67e22",
  },
  {
    area: "new_town",
    bounds: [[55.953, -3.215], [55.963, -3.175]],
    color: "#2980b9",
  },
  {
    area: "cowgate_grassmarket",
    bounds: [[55.946, -3.200], [55.949, -3.184]],
    color: "#8e44ad",
  },
  {
    area: "pleasance",
    bounds: [[55.946, -3.184], [55.951, -3.173]],
    color: "#27ae60",
  },
  {
    area: "george_square",
    bounds: [[55.942, -3.192], [55.947, -3.184]],
    color: "#c0392b",
  },
  {
    area: "southside",
    bounds: [[55.930, -3.200], [55.942, -3.170]],
    color: "#16a085",
  },
];

export function AreaMap() {
  useEffect(() => {
    // Leaflet sets window.L internally — no extra setup needed
  }, []);

  return (
    <MapContainer
      center={[55.948, -3.190]}
      zoom={14}
      style={{ height: 340, width: "100%", borderRadius: 10, zIndex: 0 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {AREAS.map(({ area, bounds, color }) => (
        <Rectangle
          key={area}
          bounds={bounds}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
        >
          <Tooltip permanent direction="center" className="area-tooltip">
            {AREA_LABELS[area]}
          </Tooltip>
        </Rectangle>
      ))}
    </MapContainer>
  );
}
