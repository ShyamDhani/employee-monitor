import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { Box, Typography, Card, CardContent, Chip, CircularProgress } from '@mui/material';
import { CheckCircle, Warning, TravelExplore } from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

// Free, keyless basemaps. Tried in order when tiles fail to load.
const TILE_SOURCES = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
  },
];

const addressCache = {};

function AddressLine({ lat, lng }) {
  const [address, setAddress] = useState(null);
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  useEffect(() => {
    let alive = true;
    if (addressCache[key]) {
      setAddress(addressCache[key]);
      return () => { alive = false; };
    }
    setAddress('Looking up address…');
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`)
      .then((r) => r.json())
      .then((data) => {
        const line = data.display_name || 'Address not found';
        addressCache[key] = line;
        if (alive) setAddress(line);
      })
      .catch(() => { if (alive) setAddress('Address lookup unavailable'); });
    return () => { alive = false; };
  }, [key, lat, lng]);

  return (
    <div style={{ fontSize: 12, color: '#666', marginBottom: 6, lineHeight: 1.35 }}>
      {address}
    </div>
  );
}

const createIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
};

const greenIcon = createIcon('#4CAF50');
const redIcon = createIcon('#F44336');

function MapUpdater({ center }) {
  const map = useMap();
  useMemo(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function EmployeeGoogleMap({
  locations = [],
  geofences = [],
  selectedEmployee = 'all',
  height = 500,
}) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [tileSource, setTileSource] = useState(0);
  const [tileErrors, setTileErrors] = useState(0);

  const handleTileError = useCallback(() => {
    setTileErrors((n) => {
      const next = n + 1;
      if (next >= 4) {
        setTileSource((s) => (s + 1) % TILE_SOURCES.length);
        return 0;
      }
      return next;
    });
  }, []);

  const filteredLocations = useMemo(() => {
    const valid = (l) =>
      typeof l?.latitude === 'number' && typeof l?.longitude === 'number' &&
      !Number.isNaN(l.latitude) && !Number.isNaN(l.longitude);
    const list = locations.filter(valid);
    if (selectedEmployee === 'all') return list;
    return list.filter((l) => l.employeeId === selectedEmployee);
  }, [locations, selectedEmployee]);

  const mapCenter = useMemo(() => {
    if (filteredLocations.length === 0) return DEFAULT_CENTER;
    const avgLat = filteredLocations.reduce((sum, l) => sum + (l.latitude || 0), 0) / filteredLocations.length;
    const avgLng = filteredLocations.reduce((sum, l) => sum + (l.longitude || 0), 0) / filteredLocations.length;
    return { lat: avgLat, lng: avgLng };
  }, [filteredLocations]);

  const isInsideGeofence = useCallback((lat, lng) => {
    return geofences.some((fence) => {
      if (!fence.active) return true;
      const R = 6371;
      const dLat = (fence.lat - lat) * Math.PI / 180;
      const dLon = (fence.lng - lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((fence.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c <= fence.radius;
    });
  }, [geofences]);

  return (
    <Box sx={{ height, position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={filteredLocations.length > 1 ? 11 : 14}
        style={{ width: '100%', height: `${height}px` }}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={tileSource}
          url={TILE_SOURCES[tileSource].url}
          attribution={TILE_SOURCES[tileSource].attribution}
          eventHandlers={{ tileerror: handleTileError }}
        />

        <MapUpdater center={mapCenter} />

        {filteredLocations.map((loc) => {
          const inside = isInsideGeofence(loc.latitude, loc.longitude);
          return (
            <Marker
              key={loc.employeeId}
              position={[loc.latitude, loc.longitude]}
              icon={inside ? greenIcon : redIcon}
              eventHandlers={{
                click: () => setSelectedLocation(loc),
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {inside ? (
                      <CheckCircle style={{ fontSize: 16, color: '#4CAF50' }} />
                    ) : (
                      <Warning style={{ fontSize: 16, color: '#F44336' }} />
                    )}
                    <strong style={{ fontSize: 14 }}>{loc.employeeId}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                    {loc.latitude?.toFixed(6)}, {loc.longitude?.toFixed(6)}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                    Accuracy: {loc.accuracy?.toFixed(0) || 'N/A'}m
                  </div>
                  <AddressLine lat={loc.latitude} lng={loc.longitude} />
                  {loc.speed > 0 && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                      Speed: {(loc.speed * 3.6).toFixed(1)} km/h
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    {new Date(loc.timestamp).toLocaleString()}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: 'white',
                    background: inside ? '#4CAF50' : '#F44336',
                  }}>
                    {inside ? 'Inside Zone' : 'Outside Zone'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {geofences
          .filter((f) => f.active)
          .map((fence) => (
            <Circle
              key={fence.id}
              center={[fence.lat, fence.lng]}
              radius={fence.radius * 1000}
              pathOptions={{
                fillColor: '#4CAF50',
                fillOpacity: 0.1,
                color: '#4CAF50',
                opacity: 0.6,
                weight: 2,
              }}
            />
          ))}
      </MapContainer>

      {filteredLocations.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            flexDirection: 'column', gap: 1, px: 3, textAlign: 'center',
            bgcolor: 'rgba(10,13,20,0.78)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <TravelExplore sx={{ fontSize: 44, color: '#22d3ee' }} />
          <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
            Waiting for a device location
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', maxWidth: 380 }}>
            The map is live and needs a GPS fix from the phone. Keep location
            permission granted on the Android app, or send a{' '}
            <b>Track Location</b> command from Live Monitor.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
