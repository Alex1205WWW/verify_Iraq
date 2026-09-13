"use client";

import { useState } from "react";
import MapCanvas from "./MapCanvas";
import { useT } from "./Intl";

type Hit = { display_name: string; lat: string; lon: string };

/**
 * Either way of setting a location, as Mohamm described it: type the address
 * and choose from the suggestions, or drop a pin. Both end at coordinates,
 * which is all the rest of the system cares about.
 *
 * Geocoding runs against OpenStreetMap's Nominatim so the MVP needs no billing
 * account. Swapping in Google Places is a change to searchAddress alone.
 */
export default function LocationPicker() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");

  async function searchAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNote(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as Hit[];
      setHits(data);
      if (data.length === 0) setNote(t.client.searchEmpty);
    } catch {
      setNote(t.client.searchFailed);
    } finally {
      setSearching(false);
    }
  }

  function choose(hit: Hit) {
    setPicked({ lat: Number(hit.lat), lng: Number(hit.lon) });
    setAddress(hit.display_name);
    setHits([]);
  }

  return (
    <div className="stack">
      <form onSubmit={searchAddress} className="field">
        <label htmlFor="addr-q">{t.client.findAddress}</label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input
            id="addr-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.client.addressPlaceholder}
            style={{ minWidth: 0 }}
          />
          <button type="submit" className="btn" disabled={searching}>
            {searching ? "…" : t.common.search}
          </button>
        </div>
        <span className="hint">{t.client.orTapMap}</span>
      </form>

      {note && <div className="notice">{note}</div>}

      {hits.length > 0 && (
        <div className="card">
          <div className="rows">
            {hits.map((hit) => (
              <button
                key={`${hit.lat}-${hit.lon}`}
                type="button"
                className="rowitem"
                style={{
                  background: "none",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                  font: "inherit",
                }}
                onClick={() => choose(hit)}
              >
                <span className="main">
                  <strong>{hit.display_name.split(",")[0]}</strong>
                  <span>{hit.display_name}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <MapCanvas
        picker
        onPick={(lat, lng) => {
          setPicked({ lat, lng });
          if (!address) setAddress(`${t.client.pinnedAt} ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }}
        markers={
          picked
            ? [
                {
                  id: "picked",
                  lat: picked.lat,
                  lng: picked.lng,
                  tone: "wait",
                  title: t.client.where,
                },
              ]
            : []
        }
        center={picked ?? undefined}
      />

      <div className="field">
        <label htmlFor="addressText">{t.client.addressAsRead}</label>
        <input
          id="addressText"
          name="addressText"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t.client.addressExample}
          required
        />
      </div>

      <input type="hidden" name="lat" value={picked?.lat ?? ""} />
      <input type="hidden" name="lng" value={picked?.lng ?? ""} />

      <p className="small dim mono" style={{ margin: 0 }}>
        {picked
          ? `${t.client.coordsAre} ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`
          : t.client.noCoords}
      </p>
    </div>
  );
}
