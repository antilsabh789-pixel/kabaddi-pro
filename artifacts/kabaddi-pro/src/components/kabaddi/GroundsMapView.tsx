'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Layers } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Leaflet CSS — imported here so the bundle includes it. Vite will tree-shake
// the rest of the leaflet package if not used.
import 'leaflet/dist/leaflet.css';

// ─── Types ────────────────────────────────────────────────────────

interface Ground {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  surface: string | null;
  lat: number | null;
  lng: number | null;
  mapLink: string | null;
  _count: { matches: number };
  // Academy-specific fields
  isAcademy?: boolean;
  coachName?: string | null;
  playerCount?: number;
}

/**
 * Build a Google Maps URL from a ground/academy record.
 * Mirrors the helper in GroundsScreen.tsx so the map popup's "Open in Google Maps"
 * button always opens something useful — even for academies with only a text
 * address (no coordinates, no mapLink).
 */
function buildGoogleMapsUrl(g: Ground): string | null {
  if (g.mapLink && /^https?:\/\//i.test(g.mapLink)) return g.mapLink;
  if (g.lat !== null && g.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
  }
  const parts = [g.name, g.address, g.city, g.state].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

interface GroundsMapViewProps {
  grounds: Ground[];
  userLat: number | null;
  userLng: number | null;
  onViewDetail: (groundId: string) => void;
}

// ─── Custom pin icon (no external image assets needed) ────────────
// We build a DivIcon from inline SVG markup so we don't depend on
// leaflet's default marker images (which break in bundlers like Vite).

const SURFACE_COLORS: Record<string, string> = {
  mat: '#0d9488',       // teal-600
  mud: '#d97706',       // amber-600
  grass: '#16a34a',     // green-600
  synthetic: '#9333ea', // purple-600
};

function makeGroundIcon(surface: string | null): L.DivIcon {
  const color = (surface && SURFACE_COLORS[surface]) || '#dc2626'; // brand-red default
  // 30x42 pin shape — typical Google Maps-style teardrop
  const html = `
    <div style="position: relative; width: 30px; height: 42px; transform: translate(-50%, -100%);">
      <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 27 15 27s15-16 15-27C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'kabaddi-ground-pin',
    iconSize: [30, 42],
    iconAnchor: [15, 42], // tip of the pin
    popupAnchor: [0, -36],
  });
}

function makeUserIcon(): L.DivIcon {
  const html = `
    <div style="position: relative; width: 20px; height: 20px; transform: translate(-50%, -50%);">
      <div style="width: 20px; height: 20px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'kabaddi-user-pin',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// ─── Helper: auto-fit map bounds to show all grounds ──────────────

function FitBounds({ grounds, userLat, userLng }: { grounds: Ground[]; userLat: number | null; userLng: number | null }) {
  const map = useMap();
  const didFitRef = useRef(false);

  useEffect(() => {
    if (didFitRef.current) return;
    const points: L.LatLngExpression[] = [];
    grounds.forEach((g) => {
      if (g.lat !== null && g.lng !== null) points.push([g.lat, g.lng]);
    });
    if (userLat !== null && userLng !== null) points.push([userLat, userLng]);

    if (points.length === 0) {
      // Default to India center if no points
      map.setView([22.5937, 78.9629], 5);
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    didFitRef.current = true;
  }, [grounds, userLat, userLng, map]);

  return null;
}

// ─── Main component ───────────────────────────────────────────────

export default function GroundsMapView({ grounds, userLat, userLng, onViewDetail }: GroundsMapViewProps) {
  // Memoize icon creation per ground so we don't rebuild on every render.
  const groundsWithIcons = useMemo(
    () =>
      grounds
        .filter((g) => g.lat !== null && g.lng !== null)
        .map((g) => ({ ground: g, icon: makeGroundIcon(g.surface) })),
    [grounds],
  );

  const userIcon = useMemo(() => makeUserIcon(), []);
  const groundsWithoutCoords = grounds.filter((g) => g.lat === null || g.lng === null);

  return (
    <div className="px-4 py-3">
      <div className="rounded-2xl overflow-hidden border border-warm-200 dark:border-warm-700 shadow-sm bg-white dark:bg-warm-800">
        <div style={{ height: '420px', width: '100%' }}>
          <MapContainer
            center={[22.5937, 78.9629]} // India center — FitBounds will correct on mount
            zoom={5}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds grounds={grounds} userLat={userLat} userLng={userLng} />

            {/* User location pin */}
            {userLat !== null && userLng !== null && (
              <Marker position={[userLat, userLng]} icon={userIcon}>
                <Popup>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>You are here</div>
                </Popup>
              </Marker>
            )}

            {/* Ground pins */}
            {groundsWithIcons.map(({ ground, icon }) => {
              const mapsUrl = buildGoogleMapsUrl(ground);
              return (
              <Marker key={ground.id} position={[ground.lat!, ground.lng!]} icon={icon}>
                <Popup>
                  <div style={{ minWidth: '180px', fontSize: '12px' }}>
                    {ground.isAcademy && (
                      <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0d9488', color: 'white', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                        ACADEMY
                      </div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px', color: '#1c1917' }}>
                      {ground.name}
                    </div>
                    {(ground.city || ground.state || ground.address) && (
                      <div style={{ color: '#78716c', marginBottom: '6px' }}>
                        {[ground.address, ground.city, ground.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {ground.isAcademy && ground.coachName && (
                      <div style={{ color: '#78716c', marginBottom: '6px' }}>
                        Coach: <strong>{ground.coachName}</strong>
                      </div>
                    )}
                    {ground.surface && !ground.isAcademy && (
                      <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', backgroundColor: SURFACE_COLORS[ground.surface] || '#78716c', color: 'white', fontSize: '10px', fontWeight: 600, marginBottom: '6px' }}>
                        {ground.surface.toUpperCase()}
                      </div>
                    )}
                    <div style={{ color: '#78716c', marginBottom: '8px' }}>
                      {ground.isAcademy
                        ? `${ground.playerCount ?? 0} player${(ground.playerCount ?? 0) !== 1 ? 's' : ''}`
                        : `${ground._count.matches} match${ground._count.matches !== 1 ? 'es' : ''}`}
                    </div>
                    <button
                      onClick={() => onViewDetail(ground.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '6px 8px',
                        backgroundColor: '#0d9488',
                        color: 'white',
                        border: '0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 8px',
                          marginTop: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#0d9488',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'center',
                          textDecoration: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Stats bar below the map */}
        <div className="px-3 py-2.5 border-t border-warm-200 dark:border-warm-700 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-warm-600 dark:text-warm-300">
            <MapPin className="w-3.5 h-3.5 text-brand-teal" />
            <span className="font-semibold">{groundsWithIcons.length}</span>
            <span>on map</span>
          </div>
          {groundsWithoutCoords.length > 0 && (
            <div className="flex items-center gap-1.5 text-warm-500 dark:text-warm-400">
              <Layers className="w-3.5 h-3.5" />
              <span>{groundsWithoutCoords.length} without coordinates (in list only)</span>
            </div>
          )}
          {userLat !== null && userLng !== null && (
            <div className="flex items-center gap-1.5 text-warm-500 dark:text-warm-400">
              <Navigation className="w-3.5 h-3.5 text-blue-500" />
              <span>Your location shown</span>
            </div>
          )}
        </div>
      </div>

      {/* Empty state inside map view */}
      {groundsWithIcons.length === 0 && (
        <div className="mt-3 text-center text-xs text-warm-500 dark:text-warm-400 px-4 py-3 bg-warm-50 dark:bg-warm-800 rounded-xl border border-warm-200 dark:border-warm-700">
          No grounds have coordinates yet. Switch back to list view and add a Google Maps link to see grounds on the map.
        </div>
      )}
    </div>
  );
}

// Suppress unused import warning for renderToStaticMarkup (kept for future use
// if we need to render React components into Leaflet popups).
void renderToStaticMarkup;
