"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./Intl";

const MIN_MOVE_METRES = 60;
const MIN_GAP_MS = 30_000;

function metresBetween(a: GeolocationCoordinates, bLat: number, bLng: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - a.latitude);
  const dLng = rad(bLng - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Sends the researcher's position on movement rather than on a timer.
 *
 * watchPosition lets the operating system decide when to wake the GPS, and we
 * only write to the server once the device has actually moved a meaningful
 * distance. Someone sitting still for two hours costs almost no battery and
 * generates almost no traffic; someone driving across the city updates often.
 *
 * The honest limit: a browser stops entirely when the tab is closed. That is
 * what a native app fixes, and nothing else here does.
 */
export default function LocationPinger({ enabled }: { enabled: boolean }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "on" | "denied" | "unsupported">("idle");
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState("on");
        const prev = last.current;
        const moved = prev ? metresBetween(pos.coords, prev.lat, prev.lng) : Infinity;
        const waited = prev ? Date.now() - prev.at : Infinity;
        if (moved < MIN_MOVE_METRES && waited < MIN_GAP_MS) return;

        last.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: Date.now(),
        };

        void fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }).catch(() => {
          /* offline — the next movement will retry */
        });
      },
      () => setState("denied"),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  if (!enabled) {
    return (
      <p className="small dim" style={{ margin: 0 }}>
        {t.researcher.pinHidden}
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="small" style={{ margin: 0, color: "var(--bad)" }}>
        {t.researcher.locationBlocked}
      </p>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="small dim" style={{ margin: 0 }}>
        {t.researcher.noGeolocation}
      </p>
    );
  }
  return (
    <p className="small dim" style={{ margin: 0 }}>
      {state === "on" ? t.researcher.movingNote : t.researcher.waitingFix}
    </p>
  );
}
