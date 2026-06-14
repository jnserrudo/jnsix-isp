import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import maplibregl from 'maplibre-gl';

interface MapContextType {
  map: maplibregl.Map | null;
  isLoaded: boolean;
}

const MapContext = createContext<MapContextType>({ map: null, isLoaded: false });

export const useMap = () => useContext(MapContext);

interface MapProps {
  center: [number, number]; // [lng, lat]
  zoom: number;
  className?: string;
  children?: React.ReactNode;
}

export const Map: React.FC<MapProps> = ({ center, zoom, className, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Define standard raster-based OSM tile specifications for maplibre
    const osmStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style: osmStyle,
      center: center,
      zoom: zoom,
      attributionControl: false,
    });

    mapInstance.on('load', () => {
      setIsLoaded(true);
      // Force resize to compute container dimensions correctly
      setTimeout(() => {
        mapInstance.resize();
      }, 100);
    });

    setMap(mapInstance);

    return () => {
      try {
        mapInstance.remove();
      } catch (e) {
        console.warn('Map cleanup error:', e);
      }
    };
  }, []);

  // Resize observer to handle container size changes dynamically (e.g. flex resizing, modals opening, tab switching)
  useEffect(() => {
    if (!map || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  // Update center if it changes externally
  useEffect(() => {
    if (map && isLoaded) {
      map.setCenter(center);
    }
  }, [center[0], center[1], map, isLoaded]);

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%' 
      }}
    >
      {map && (
        <MapContext.Provider value={{ map, isLoaded }}>
          {children}
        </MapContext.Provider>
      )}
    </div>
  );
};

interface MapMarkerProps {
  longitude: number;
  latitude: number;
  draggable?: boolean;
  onDragEnd?: (e: { lat: number; lng: number }) => void;
  children?: React.ReactNode;
}

export const MapMarker: React.FC<MapMarkerProps> = ({
  longitude,
  latitude,
  draggable = false,
  onDragEnd,
  children,
}) => {
  const { map, isLoaded } = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(document.createElement('div'));

  useEffect(() => {
    if (!map || !isLoaded) return;

    const el = containerRef.current;
    
    // Set cursor styles on custom container element
    el.style.cursor = 'pointer';

    const marker = new maplibregl.Marker({
      element: el,
      draggable: draggable,
    })
      .setLngLat([longitude, latitude])
      .addTo(map);

    markerRef.current = marker;

    if (draggable && onDragEnd) {
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onDragEnd({ lat: lngLat.lat, lng: lngLat.lng });
      });
    }

    return () => {
      try {
        marker.remove();
      } catch (e) {
        console.warn('Marker cleanup error:', e);
      }
      markerRef.current = null;
    };
  }, [map, isLoaded, draggable]);

  // Handle updates to latitude/longitude props
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [longitude, latitude]);

  return ReactDOM.createPortal(children, containerRef.current);
};

export const MarkerContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

interface MapControlsProps {
  showZoom?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({ showZoom = true }) => {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !showZoom) return;

    const nav = new maplibregl.NavigationControl({
      showCompass: false,
      showZoom: true,
    });

    map.addControl(nav, 'top-right');

    return () => {
      try {
        map.removeControl(nav);
      } catch (e) {
        console.warn('NavigationControl cleanup error:', e);
      }
    };
  }, [map, isLoaded, showZoom]);

  return null;
};
