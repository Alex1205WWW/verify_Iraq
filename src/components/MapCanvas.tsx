"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  /** ok = available, wait = queued task, warn = offered, info = working */
  tone: "ok" | "warn" | "bad" | "wait" | "info" | "plain";
  title: string;
  lines?: string[];
  href?: string;
};

const TONE_HEX: Record<MapMarker["tone"], string> = {
  ok: "#2c6e4c",
  warn: "#8e6212",
  bad: "#9e3030",
  wait: "#41528a",
  info: "#0b5b66",
  plain: "#66797e",
};

/**
 * OpenStreetMap tiles through Leaflet — no API key, no billing account, and
 * nothing to configure before the app runs. Swapping in Google Maps later is a
 * change to this one file; every caller passes plain coordinates.
 *
 * Leaflet is imported inside the effect, never at module scope. It touches
 * `window` as soon as it loads, and Next server-renders client components too,
 * so a top-level `import L from "leaflet"` throws
 * `ReferenceError: window is not defined` and takes the whole page down with
 * it. The `import type` above is erased at compile time and costs nothing.
 *
 * React also runs effects twice in development, which Leaflet does not
 * tolerate on its own — the container keeps an internal id after the first
 * mount and the second init throws "Map container is already initialized".
 * The alive flag and the id cleanup below make that double invoke a non-event.
 */
export default function MapCanvas({
  markers = [],
  center,
  zoom = 11,
  picker = false,
  onPick,
  className = "mapbox",
}: {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  picker?: boolean;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;

    let alive = true;
    let instance: Leaflet.Map | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (!alive) return;
        lib.current = L;

        // Leaflet stamps the element on init and refuses to reuse a stamped
        // one. A previous mount in the same commit may have left it behind.
        const stamped = node as HTMLDivElement & { _leaflet_id?: number };
        if (stamped._leaflet_id) delete stamped._leaflet_id;

        instance = L.map(node, {
          center: [center?.lat ?? 33.3152, center?.lng ?? 44.3661],
          zoom,
          scrollWheelZoom: false,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(instance);

        layer.current = L.layerGroup().addTo(instance);
        map.current = instance;

        if (picker) {
          instance.on("click", (e: Leaflet.LeafletMouseEvent) => {
            pickRef.current?.(e.latlng.lat, e.latlng.lng);
          });
        }

        // The container is sized by CSS, which may settle after mount. A
        // ResizeObserver is exact where a timeout was a guess, and it cannot
        // fire after the map has been torn down.
        observer = new ResizeObserver(() => {
          if (alive && map.current) map.current.invalidateSize();
        });
        observer.observe(node);

        setReady(true);
        setFailed(null);
      } catch (err) {
        // A broken map must not take the surrounding page with it.
        if (alive) {
          setFailed(err instanceof Error ? err.message : "The map could not load.");
        }
      }
    })();

    return () => {
      alive = false;
      observer?.disconnect();
      if (instance) {
        instance.off();
        instance.remove();
      }
      map.current = null;
      layer.current = null;
    };
    // Created once. Marker and view updates happen in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = lib.current;
    const instance = map.current;
    const group = layer.current;
    if (!ready || !L || !instance || !group) return;

    group.clearLayers();

    for (const m of markers) {
      const colour = TONE_HEX[m.tone];
      const icon = L.divIcon({
        className: "",
        html: `<span class="marker-dot" style="display:block;width:16px;height:16px;background:${colour}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([m.lat, m.lng], { icon, title: m.title }).addTo(group);

      const lines = (m.lines ?? [])
        .filter(Boolean)
        .map((l) => `<div style="color:#66797e">${escapeHtml(l)}</div>`)
        .join("");
      const link = m.href
        ? `<div style="margin-top:6px"><a href="${escapeHtml(m.href)}">&rarr;</a></div>`
        : "";

      marker.bindPopup(
        `<div style="font-family:inherit;font-size:13px;line-height:1.5">
           <strong>${escapeHtml(m.title)}</strong>${lines}${link}
         </div>`,
      );
    }

    if (markers.length === 1) {
      instance.setView([markers[0].lat, markers[0].lng], Math.max(zoom, 14));
    } else if (markers.length > 1) {
      instance.fitBounds(
        L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])),
        { padding: [36, 36], maxZoom: 14 },
      );
    } else if (center) {
      instance.setView([center.lat, center.lng], zoom);
    }
  }, [ready, markers, center, zoom]);

  if (failed) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center" }}>
        <p className="small dim" style={{ margin: 0, padding: 16, textAlign: "center" }}>
          {failed}
        </p>
      </div>
    );
  }

  return <div ref={holder} className={className} role="application" aria-label="Map" />;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
