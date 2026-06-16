import React, { useEffect } from 'react';
import { Map, MapMarker, MarkerContent, MapControls, useMap } from './Map';
import { MapPin } from 'lucide-react';

interface MapClickCaptureProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapClickCapture: React.FC<MapClickCaptureProps> = ({ onLocationSelect }) => {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!isLoaded || !map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      onLocationSelect(e.lngLat.lat, e.lngLat.lng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, isLoaded, onLocationSelect]);

  return null;
};

interface MapPickerProps {
  lat?: number | string | null;
  lng?: number | string | null;
  onLocationSelect: (lat: number, lng: number) => void;
  defaultCenter?: [number, number]; // [lng, lat]
  zoom?: number;
}

const MapPicker: React.FC<MapPickerProps> = ({
  lat,
  lng,
  onLocationSelect,
  defaultCenter = [-65.4117, -24.7859], // Salta Capital fallback
  zoom = 13,
}) => {
  const parsedLng = parseFloat(lng as string);
  const parsedLat = parseFloat(lat as string);

  const currentLng = !isNaN(parsedLng) ? parsedLng : defaultCenter[0];
  const currentLat = !isNaN(parsedLat) ? parsedLat : defaultCenter[1];

  const initialCoords: [number, number] = (!isNaN(parsedLng) && !isNaN(parsedLat))
    ? [parsedLng, parsedLat]
    : defaultCenter;

  return (
    <div className="map-container" style={{ width: '100%', height: '100%', minHeight: '220px', position: 'relative' }}>
      <Map center={initialCoords} zoom={zoom} className="w-full h-full">
        <MapControls showZoom />
        <MapClickCapture onLocationSelect={onLocationSelect} />
        <MapMarker
          longitude={currentLng}
          latitude={currentLat}
          draggable
          onDragEnd={(e) => onLocationSelect(e.lat, e.lng)}
        >
          <MarkerContent>
            <div
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: 'var(--accent)',
                border: '2px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                cursor: 'grab',
              }}
            >
              <MapPin size={16} style={{ color: '#ffffff' }} />
            </div>
          </MarkerContent>
        </MapMarker>
      </Map>
    </div>
  );
};

export default MapPicker;
