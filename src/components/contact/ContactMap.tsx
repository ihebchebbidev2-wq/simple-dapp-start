import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize();
    run();
    const t = window.setTimeout(run, 250);
    const ro = new ResizeObserver(run);
    const el = map.getContainer();
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function buildPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "contact-map-pin-root",
    html: `<div class="contact-map-pin" aria-hidden="true"><span class="contact-map-pin-inner"></span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -38],
  });
}

const MAP_LAYOUT = {
  default: {
    map: "contact-map-leaflet z-0 h-[min(22rem,55vh)] w-full min-h-[280px] md:h-[24rem]",
    skeleton: "h-[min(22rem,55vh)] w-full min-h-[280px] md:h-[24rem] animate-pulse bg-muted",
  },
  /** Taller map for contact page sidebar column */
  sidebar: {
    map: "contact-map-leaflet z-0 w-full min-h-[280px] h-[min(20rem,48vh)] lg:min-h-[360px] lg:h-[min(34rem,calc(100vh-12rem))]",
    skeleton:
      "min-h-[280px] h-[min(20rem,48vh)] w-full lg:min-h-[360px] lg:h-[min(34rem,calc(100vh-12rem))] animate-pulse bg-muted",
  },
} as const;

export interface ContactMapProps {
  latitude: number;
  longitude: number;
  zoom: number;
  markerTitle?: string | null;
  addressLine?: string | null;
  className?: string;
  layout?: keyof typeof MAP_LAYOUT;
}

/**
 * Leaflet map styled to match REMQUIP (light tiles, accent pin, rounded shell).
 */
export default function ContactMap({
  latitude,
  longitude,
  zoom,
  markerTitle,
  addressLine,
  className = "",
  layout = "default",
}: ContactMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const icon = useMemo(() => buildPinIcon(), []);
  const center = useMemo<[number, number]>(() => [latitude, longitude], [latitude, longitude]);
  const L = MAP_LAYOUT[layout] ?? MAP_LAYOUT.default;

  const title = markerTitle?.trim() || "REMQUIP";
  const subtitle = addressLine?.trim() || null;

  return (
    <div
      className={`contact-map-shell relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm ${className}`}
    >
      {!mounted ? (
        <div className={L.skeleton} aria-hidden />
      ) : (
        <MapContainer
          key={`${latitude}-${longitude}-${zoom}`}
          center={center}
          zoom={zoom}
          className={L.map}
          scrollWheelZoom
          zoomControl
        >
          <MapResize />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          <Marker position={center} icon={icon}>
            <Popup className="contact-map-popup">
              <div className="min-w-[12rem] text-sm">
                <p className="font-semibold text-foreground">{title}</p>
                {subtitle ? <p className="mt-1 text-muted-foreground leading-snug">{subtitle}</p> : null}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      )}
      <p className="sr-only">
        Map showing {title}
        {subtitle ? ` at ${subtitle}` : ""}. Coordinates {latitude.toFixed(5)}, {longitude.toFixed(5)}.
      </p>
    </div>
  );
}
