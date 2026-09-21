import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { cardStyle } from './AccomplishmentWidgets';

/**
 * Creative project-location map card.
 * Real interactive map (Leaflet + OpenStreetMap, no API key): the location
 * string is geocoded via Nominatim, the map centers on the exact lat/lng,
 * and a custom pulsing marker pins that exact coordinate.
 * Falls back to the Google Maps embed if geocoding finds nothing.
 */
export default function AccomplishmentLocationMap({
    location = '',
    title = 'Project Location',
    subtitle = '',
    testId = 'overview-location-map',
    height = null,
}) {
    const [loaded, setLoaded] = useState(false);
    const [coords, setCoords] = useState(null);
    const [geoLabel, setGeoLabel] = useState('');
    const [geoFailed, setGeoFailed] = useState(false);
    const mapNodeRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const trimmed = String(location ?? '').trim();
    const mapHeight = height ?? 360;
    const embedUrl = trimmed
        ? `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
        : '';
    const searchUrl = trimmed
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
        : '';

    useEffect(() => {
        setLoaded(false);
    }, [trimmed]);

    // Geocode the free-text location to exact lat/lng so the pulse marker
    // sits on the real coordinate (not a guessed overlay position).
    useEffect(() => {
        if (!trimmed) {
            setCoords(null);
            setGeoLabel('');
            setGeoFailed(false);
            return undefined;
        }
        let cancelled = false;
        setCoords(null);
        setGeoLabel('');
        setGeoFailed(false);
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal, headers: { Accept: 'application/json' } },
                );
                if (!response.ok) throw new Error(`geocode ${response.status}`);
                const [first] = await response.json();
                if (cancelled) return;
                if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lon))) {
                    setCoords({ lat: Number(first.lat), lng: Number(first.lon) });
                    setGeoLabel(String(first.display_name || '').split(',').slice(0, 3).join(','));
                } else {
                    setGeoFailed(true);
                }
            } catch (err) {
                if (!cancelled && err?.name !== 'AbortError') setGeoFailed(true);
            }
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
            controller.abort();
        };
    }, [trimmed]);

    const pulseIcon = useMemo(() => L.divIcon({
        className: 'accomp-exact-pulse-marker',
        html: `
            <span class="accomp-exact-pulse-ring"></span>
            <span class="accomp-exact-pulse-ring accomp-exact-pulse-ring-delay"></span>
            <span class="accomp-exact-pulse-dot"></span>
        `,
        iconSize: [88, 88],
        iconAnchor: [44, 44],
    }), []);

    // Build the Leaflet map once coords resolve; marker is anchored to the
    // exact geocoded point so the pulse is always on the true location.
    useEffect(() => {
        if (!coords || !mapNodeRef.current) return undefined;
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markerRef.current = null;
        }
        const map = L.map(mapNodeRef.current, {
            center: [coords.lat, coords.lng],
            zoom: 16,
            scrollWheelZoom: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        map.on('focus', () => map.scrollWheelZoom.enable());
        map.on('blur', () => map.scrollWheelZoom.disable());
        const marker = L.marker([coords.lat, coords.lng], { icon: pulseIcon, interactive: false }).addTo(map);
        markerRef.current = marker;
        mapRef.current = map;
        // Resize after the card animates in so tiles fill the frame.
        const settle = setTimeout(() => map.invalidateSize(), 250);
        setLoaded(true);
        return () => {
            clearTimeout(settle);
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, [coords, pulseIcon]);

    return (
        <div style={cardStyle} data-testid={testId}>
            <style>{`
                .accomp-exact-pulse-marker { background: transparent; border: none; }
                .accomp-exact-pulse-marker .accomp-exact-pulse-ring {
                    position: absolute; left: 0; top: 0; width: 88px; height: 88px;
                    border-radius: 999px; background: rgba(2, 132, 199, 0.28);
                    border: 2px solid rgba(2, 132, 199, 0.55);
                    animation: accomp-map-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                .accomp-exact-pulse-marker .accomp-exact-pulse-ring-delay { animation-delay: 1.1s; }
                .accomp-exact-pulse-marker .accomp-exact-pulse-dot {
                    position: absolute; left: 33px; top: 33px; width: 22px; height: 22px;
                    border-radius: 999px; background: #0284c7; border: 4px solid #fff;
                    box-shadow: 0 8px 20px rgba(2,132,199,0.55);
                    animation: accomp-map-pin-float 2.2s ease-in-out infinite;
                }
                @keyframes accomp-map-ping {
                    0% { transform: scale(0.35); opacity: 0.85; }
                    70% { transform: scale(1); opacity: 0; }
                    100% { transform: scale(1.15); opacity: 0; }
                }
                @keyframes accomp-map-pin-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .accomp-map-pulse-ring,
                    .accomp-map-pulse-pin,
                    .accomp-exact-pulse-marker .accomp-exact-pulse-ring,
                    .accomp-exact-pulse-marker .accomp-exact-pulse-dot { animation: none !important; }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: '#0ea5e9', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={12} strokeWidth={2.5} />
                </span>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)' }}>{title}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)', marginBottom: 12 }}>
                {subtitle || (trimmed || 'No pinned location yet')}
            </div>
            {embedUrl ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--ac-border, #e8edf3)', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 55%, #fefce8 100%)', minHeight: mapHeight }}>
                    {coords ? (
                        <div ref={mapNodeRef} data-testid="overview-location-leaflet" style={{ width: '100%', height: mapHeight, position: 'relative', zIndex: 1 }} />
                    ) : (
                        <>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ac-muted, #64748b)', fontSize: 12, fontWeight: 600 }}>
                                <span style={{ width: 34, height: 34, borderRadius: 999, background: '#fff', border: '1px solid var(--ac-border, #e8edf3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                    <MapPin size={16} strokeWidth={2.5} />
                                </span>
                                {geoFailed ? 'Exact pin unavailable — showing area map…' : 'Locating exact project pin…'}
                            </div>
                            <iframe
                                title={`Map of ${trimmed}`}
                                src={embedUrl}
                                style={{ width: '100%', height: mapHeight, border: 0, display: 'block', position: 'relative', opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                allowFullScreen
                                onLoad={() => setLoaded(true)}
                            />
                        </>
                    )}
                    <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', pointerEvents: 'none', zIndex: 500 }}>
                        <span style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.94)', border: '1px solid var(--ac-border, #e8edf3)', borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)', boxShadow: '0 6px 16px rgba(2,132,199,0.18)', maxWidth: '70%' }}>
                            <span style={{ width: 22, height: 22, borderRadius: 999, background: '#0284c7', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MapPin size={12} strokeWidth={2.5} />
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{geoLabel ? `${trimmed} · ${geoLabel}` : trimmed}</span>
                        </span>
                        <a
                            href={searchUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ pointerEvents: 'auto', background: '#0284c7', color: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 800, textDecoration: 'none', boxShadow: '0 6px 16px rgba(2,132,199,0.35)' }}
                        >
                            Open in Maps
                        </a>
                    </div>
                </div>
            ) : (
                <div style={{ borderRadius: 12, border: '1px dashed var(--ac-border, #cbd5e1)', background: 'var(--ac-border-soft, #f8fafc)', padding: 24, textAlign: 'center', color: 'var(--ac-muted, #64748b)', fontSize: 13, display: 'grid', gap: 8, justifyItems: 'center' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 999, background: '#fff', border: '1px solid var(--ac-border, #e8edf3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <MapPin size={16} strokeWidth={2.5} />
                    </span>
                    No location pinned for this project yet.
                </div>
            )}
        </div>
    );
}
