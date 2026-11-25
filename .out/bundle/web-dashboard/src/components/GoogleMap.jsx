import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  Map,
  AdvancedMarker,
  Circle,
  InfoWindow,
  useMap,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { Box, Typography, CircularProgress } from '@mui/material';
import { CheckCircle, Warning, TravelExplore } from '@mui/icons-material';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from '../config/maps';
import LeafletMap, { AddressLine, isInsideGeofence } from './LeafletMap';

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

function LocationDetails({ loc, inside }) {
  return (
    <div style={{ minWidth: 200, padding: 4 }}>
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
  );
}

function EmptyOverlay() {
  return (
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
  );
}

function MapUpdater({ center, zoom }) {
  const map = useMap();
  const lastView = useRef(null);

  useEffect(() => {
    if (!map || !center) return;
    const view = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}@${zoom}`;
    if (lastView.current === null) {
      lastView.current = view;
      return;
    }
    if (lastView.current === view) return;
    lastView.current = view;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center, zoom]);

  return null;
}

function GoogleMapView({ locations = [], geofences = [], selectedEmployee = 'all', height = 500 }) {
  const [selectedLocation, setSelectedLocation] = useState(null);

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

  const zoom = filteredLocations.length > 1 ? 11 : 14;

  const selectedInside = selectedLocation
    ? isInsideGeofence(geofences, selectedLocation.latitude, selectedLocation.longitude)
    : false;

  return (
    <Box sx={{ height, position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
      <Map
        defaultCenter={mapCenter}
        defaultZoom={zoom}
        mapId={GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        style={{ width: '100%', height: `${height}px` }}
      >
        <MapUpdater center={mapCenter} zoom={zoom} />

        {filteredLocations.map((loc) => {
          const inside = isInsideGeofence(geofences, loc.latitude, loc.longitude);
          return (
            <AdvancedMarker
              key={loc.employeeId}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              onClick={() => setSelectedLocation(loc)}
            >
              <div style={{
                width: 16, height: 16,
                background: inside ? '#4CAF50' : '#F44336',
                border: '2px solid white',
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
              }} />
            </AdvancedMarker>
          );
        })}

        {geofences
          .filter((f) => f.active)
          .map((fence) => (
            <Circle
              key={fence.id}
              center={{ lat: fence.lat, lng: fence.lng }}
              radius={fence.radius * 1000}
              strokeColor="#4CAF50"
              strokeOpacity={0.6}
              strokeWeight={2}
              fillColor="#4CAF50"
              fillOpacity={0.1}
              clickable={false}
            />
          ))}

        {selectedLocation && (
          <InfoWindow
            position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
            onCloseClick={() => setSelectedLocation(null)}
            onClose={() => setSelectedLocation(null)}
          >
            <LocationDetails loc={selectedLocation} inside={selectedInside} />
          </InfoWindow>
        )}
      </Map>

      {filteredLocations.length === 0 && <EmptyOverlay />}
    </Box>
  );
}

function MapSurface(props) {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    console.error('Google Maps failed to load, falling back to OpenStreetMap tiles.', status);
    return <LeafletMap {...props} />;
  }

  if (status !== APILoadingStatus.LOADED) {
    return (
      <Box
        sx={{
          height: props.height,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(10,13,20,0.9)',
          borderRadius: 2,
        }}
      >
        <CircularProgress size={36} />
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Loading Google Maps…
        </Typography>
      </Box>
    );
  }

  return <GoogleMapView {...props} />;
}

export default function EmployeeGoogleMap(props) {
  const [loadError, setLoadError] = useState(null);

  if (!GOOGLE_MAPS_API_KEY) {
    return <LeafletMap {...props} />;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      onError={(error) => {
        setLoadError(error);
        console.error('Google Maps API load error:', error);
      }}
    >
      {loadError ? <LeafletMap {...props} /> : <MapSurface {...props} />}
    </APIProvider>
  );
}
