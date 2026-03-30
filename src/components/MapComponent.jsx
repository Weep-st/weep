import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
};

const MapComponent = ({ 
  localLat, 
  localLng, 
  deliveryLat, 
  deliveryLng, 
  driverLat,
  driverLng,
  localName = 'Local', 
  deliveryAddress = 'Destino',
  isLoaded
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);

  const center = useMemo(() => {
    if (driverLat && driverLng) return { lat: Number(driverLat), lng: Number(driverLng) };
    if (localLat && localLng) return { lat: Number(localLat), lng: Number(localLng) };
    if (deliveryLat && deliveryLng) return { lat: Number(deliveryLat), lng: Number(deliveryLng) };
    // Default center: Santo Tomé, Corrientes, Argentina (Centro Urbano)
    return { lat: -28.5489, lng: -56.0411 }; 
  }, [localLat, localLng, deliveryLat, deliveryLng, driverLat, driverLng]);

  const isWithinSantoTome = (lat, lng) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    // Rango ampliado para cubrir periferia de Santo Tomé, Corrientes (W3340)
    return latNum <= -28.1 && latNum >= -28.9 && lngNum <= -55.7 && lngNum >= -56.4;
  };

  const markers = useMemo(() => {
    const m = [];
    if (localLat && localLng && isWithinSantoTome(localLat, localLng)) {
      m.push({
        id: 'local',
        position: { lat: Number(localLat), lng: Number(localLng) },
        title: localName,
        icon: 'https://i.postimg.cc/ZKHbrvdP/Home-free-icons-designed-by-nawicon-(1).png'
      });
    }
    if (deliveryLat && deliveryLng && isWithinSantoTome(deliveryLat, deliveryLng)) {
      m.push({
        id: 'delivery',
        position: { lat: Number(deliveryLat), lng: Number(deliveryLng) },
        title: deliveryAddress,
        icon: 'https://i.postimg.cc/zfbqZdPs/Home-free-icons-designed-by-nawicon.png'
      });
    }
    if (driverLat && driverLng && isWithinSantoTome(driverLat, driverLng)) {
      m.push({
        id: 'driver',
        position: { lat: Number(driverLat), lng: Number(driverLng) },
        title: 'Tu ubicación',
        icon: 'https://img.icons8.com/color/48/motorcycle.png'
      });
    }
    return m;
  }, [localLat, localLng, deliveryLat, deliveryLng, driverLat, driverLng, localName, deliveryAddress]);

  // Ensure map centers on new markers when they change
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    if (markers.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.position));
      mapInstance.fitBounds(bounds);
    }
  }, [markers]);

  if (!isLoaded) return <div style={{ height: '350px', background: '#f0f0f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando mapa...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={14}
      onLoad={onLoad}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        fullscreenControl: true,
        restriction: {
          latLngBounds: {
            north: -28.3,
            south: -28.8,
            west: -56.3,
            east: -55.8,
          },
          strictBounds: false
        }
      }}
    >
      {markers.map((marker) => (
        <MarkerF
          key={marker.id}
          position={marker.position}
          onClick={() => setSelectedMarker(marker)}
          icon={{
            url: marker.icon,
            scaledSize: marker.id === 'driver' ? new window.google.maps.Size(46, 46) : new window.google.maps.Size(40, 40)
          }}
        />
      ))}

      {selectedMarker && (
        <InfoWindowF
          position={selectedMarker.position}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div style={{ padding: '4px', color: '#333' }}>
            <strong style={{ display: 'block' }}>
              {selectedMarker.id === 'driver' ? '🏍️ Repartidor en camino' : 
               selectedMarker.id === 'local' ? '🏪 Recoger en:' : '📍 Entregar en:'}
            </strong>
            <span>{selectedMarker.title}</span>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
};

export default React.memo(MapComponent);
