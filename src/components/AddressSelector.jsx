import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Autocomplete, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import './AddressSelector.css';

const SANTO_TOME_CENTER = { lat: -28.5489, lng: -56.0411 };
const CITY_STRINGS = [
  'santo tomé, corrientes', 
  'santo tomé', 
  'santo tome, corrientes', 
  'santo tome',
  'santo tomé, corrientes province',
  'santo tome, corrientes province',
  'santo tomé, provincia de corrientes',
  'santo tome, provincia de corrientes'
];

const isJustCity = (addr) => {
  if (!addr) return true;
  const lower = addr.toLowerCase();
  return CITY_STRINGS.some(s => lower.startsWith(s)) && lower.length < 60;
};

const AddressSelector = ({ 
  onConfirm, 
  onCancel, 
  initialAddress = '', 
  initialCoords = null, 
  isLoaded,
  title = 'Confirmar Ubicación de Entrega',
  errorMsg = 'Solo realizamos envíos dentro de Santo Tomé.'
}) => {

  const [map, setMap] = useState(null);
  const [position, setPosition] = useState(initialCoords || SANTO_TOME_CENTER);
  const [address, setAddress] = useState(initialAddress);
  const [reference, setReference] = useState('');
  const [isValidArea, setIsValidArea] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const autocompleteRef = useRef(null);
  const lastResolvedAddress = useRef(initialAddress);

  // Validación de área (Santo Tomé)
  const checkArea = useCallback((lat, lng) => {
    // Rango ampliado usado en MapComponent.jsx
    return lat <= -28.3 && lat >= -28.8 && lng <= -55.8 && lng >= -56.3;
  }, []);

  useEffect(() => {
    setIsValidArea(checkArea(position.lat, position.lng));
  }, [position, checkArea]);

  // Geocodificación inicial si solo hay texto
  useEffect(() => {
    if (isLoaded && initialAddress && !initialCoords && !address) {
      if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
        console.error("❌ Google Maps Geocoder requested but not available yet.");
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      const fullAddress = `${initialAddress}, Santo Tomé, Corrientes, Argentina`;
      geocoder.geocode({ address: fullAddress, componentRestrictions: { country: 'AR' } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const newPos = { lat: lat(), lng: lng() };
          setPosition(newPos);
          setAddress(results[0].formatted_address);
          lastResolvedAddress.current = results[0].formatted_address;
        }
      });
    }
  }, [isLoaded, initialAddress, initialCoords]);

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const fmtAddr = place.formatted_address || '';
        
        if (isJustCity(fmtAddr)) {
          toast.error('Dirección no encontrada, por favor indica tu dirección con el marcador');
          return;
        }

        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setPosition(newPos);
        setAddress(fmtAddr);
        lastResolvedAddress.current = fmtAddr;
        if (map) {
          map.panTo(newPos);
          map.setZoom(17);
        }
      }
    }
  };

  const onMarkerDragEnd = (e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    setPosition(newPos);

    // Geocodificación inversa
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: newPos }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const fmtAddr = results[0].formatted_address;
          setAddress(fmtAddr);
          lastResolvedAddress.current = fmtAddr;
        }
      });
    }
  };

  const handleManualGeocode = () => {
    return new Promise((resolve) => {
      if (!address || !window.google || !window.google.maps || !window.google.maps.Geocoder) {
        resolve(null);
        return;
      }
      
      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      const fullAddress = address.includes('Santo Tomé') ? address : `${address}, Santo Tomé, Corrientes, Argentina`;
      
      geocoder.geocode({ 
        address: fullAddress, 
        componentRestrictions: { country: 'AR' } 
      }, (results, status) => {
        setIsGeocoding(false);
        if (status === 'OK' && results[0]) {
          const fmtAddr = results[0].formatted_address;

          if (isJustCity(fmtAddr)) {
            resolve(null);
            return;
          }

          const { lat, lng } = results[0].geometry.location;
          const newPos = { lat: lat(), lng: lng() };
          
          setPosition(newPos);
          setAddress(fmtAddr);
          lastResolvedAddress.current = fmtAddr;
          
          if (map) map.panTo(newPos);
          resolve({ address: fmtAddr, lat: newPos.lat, lng: newPos.lng });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleConfirm = async () => {
    if (!isValidArea || isGeocoding) return;

    let finalAddress = address;
    let finalLat = position.lat;
    let finalLng = position.lng;

    // Si el texto cambió y no fue geocodificado aún, forzar geocodificación
    if (address !== lastResolvedAddress.current) {
      const result = await handleManualGeocode();
      if (result) {
        finalAddress = result.address;
        finalLat = result.lat;
        finalLng = result.lng;
      } else {
        toast.error('Dirección no encontrada, usá el marcador para cargar la dirección.');
        return;
      }
    }

    // Doble verificación: asegurarnos que tenemos calle y altura (o al menos no es solo el nombre de la ciudad)
    if (isJustCity(finalAddress)) {
      toast.error('Dirección no encontrada, por favor indica tu dirección con el marcador');
      return;
    }

    onConfirm({
      address: finalAddress,
      lat: finalLat,
      lng: finalLng,
      reference
    });
  };

  if (!isLoaded) return <div className="address-selector-loading">Cargando mapa...</div>;

  return (
    <div className="address-selector-overlay">
      <div className="address-selector-card animate-slide-up">
        <div className="address-selector-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="address-selector-body">
          <div className="input-group">
            <label>Dirección</label>
            <Autocomplete
              onLoad={(ref) => (autocompleteRef.current = ref)}
              onPlaceChanged={onPlaceChanged}
              options={{
                componentRestrictions: { country: 'AR' },
                // Restrict results strictly to Santo Tomé, Corrientes area
                bounds: { 
                  north: -28.4, 
                  south: -28.7, 
                  east: -55.9, 
                  west: -56.2 
                },
                strictBounds: true,
                fields: ['address_components', 'geometry', 'icon', 'name', 'formatted_address']
              }}
            >
              <input
                type="text"
                placeholder={title.includes('Local') ? "Ubicación de tu negocio..." : "Escribí tu calle y número (Ej: Brasil 719)..."}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualGeocode();
                  }
                }}
                className="form-input"
              />
            </Autocomplete>
          </div>

          <div className="map-wrapper">
            <GoogleMap
              mapContainerClassName="map-container"
              center={position}
              zoom={15}
              onLoad={(m) => setMap(m)}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false
              }}
            >
              <MarkerF
                position={position}
                draggable={true}
                onDragEnd={onMarkerDragEnd}
                animation={window.google.maps.Animation.DROP}
              />
            </GoogleMap>
            {!isValidArea && (
              <div className="map-error-overlay">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginTop: '16px' }}>
            <label>Referencias (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Portón negro, timbre arriba..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="address-selector-footer">
          <button 
            className={`btn btn-primary btn-full ${!isValidArea ? 'disabled' : ''}`} 
            onClick={handleConfirm}
            disabled={!isValidArea || !address || isGeocoding}
          >
            {isGeocoding ? 'Cargando...' : 'Confirmar Ubicación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressSelector;
