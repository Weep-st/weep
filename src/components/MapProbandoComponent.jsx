import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import './MapComponent.css';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const MapProbandoComponent = ({ 
  localLat, 
  localLng, 
  pedidosActivos = [],
  driverLat,
  driverLng,
  localName = 'Local', 
  isLoaded,
  directions
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);

  const center = useMemo(() => {
    if (driverLat && driverLng) return { lat: Number(driverLat), lng: Number(driverLng) };
    if (localLat && localLng) return { lat: Number(localLat), lng: Number(localLng) };
    return { lat: -28.548, lng: -56.041 }; 
  }, [localLat, localLng, driverLat, driverLng]);

  const isWithinSantoTome = (lat, lng) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return latNum <= -28.3 && latNum >= -28.8 && lngNum <= -55.8 && lngNum >= -56.3;
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

    pedidosActivos.forEach((p, index) => {
        if (p.lat && p.lng && isWithinSantoTome(p.lat, p.lng)) {
            const isRetirado = p.estado === 'Retirado';
            m.push({
                id: `pedido-${p.id}`,
                position: { lat: Number(p.lat), lng: Number(p.lng) },
                title: p.direccion,
                label: {
                  text: `${isRetirado ? 'Entrega' : 'Retiro'} ${index + 1}`,
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                },
                icon: isRetirado 
                  ? 'https://i.postimg.cc/zfbqZdPs/Home-free-icons-designed-by-nawicon.png' 
                  : 'https://i.postimg.cc/ZKHbrvdP/Home-free-icons-designed-by-nawicon-(1).png'
            });
        }
    });

    if (driverLat && driverLng && isWithinSantoTome(driverLat, driverLng)) {
      m.push({
        id: 'driver',
        position: { lat: Number(driverLat), lng: Number(driverLng) },
        title: 'Tu ubicación',
        icon: 'https://i.postimg.cc/qRrchsLY/buscamos-repartidores-(27).png'
      });
    }
    return m;
  }, [localLat, localLng, pedidosActivos, driverLat, driverLng, localName]);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  if (!isLoaded) return <div style={{ height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando mapa...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={15}
      onLoad={onLoad}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            stylers: [{ visibility: 'off' }]
          }
        ],
        restriction: {
          latLngBounds: { north: -28.3, south: -28.8, west: -56.3, east: -55.8 },
          strictBounds: false
        }
      }}
    >
      {markers.map(m => (
        <MarkerF
          key={m.id}
          position={m.position}
          title={m.title}
          icon={m.icon ? {
            url: m.icon,
            scaledSize: new window.google.maps.Size(40, 40),
            labelOrigin: new window.google.maps.Point(20, -10)
          } : null}
          label={m.label}
          onClick={() => setSelectedMarker(m)}
        />
      ))}

      {selectedMarker && (
        <InfoWindowF
          position={selectedMarker.position}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div style={{ padding: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}>{selectedMarker.title}</h4>
            {selectedMarker.label && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--red-600)', fontWeight: 'bold' }}>{selectedMarker.label.text}</p>}
          </div>
        </InfoWindowF>
      )}

      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeWeight: 6,
              strokeOpacity: 0.9
            }
          }}
        />
      )}
    </GoogleMap>
  );
};

export default React.memo(MapProbandoComponent);
