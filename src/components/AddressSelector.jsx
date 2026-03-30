import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Autocomplete, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import './AddressSelector.css';

const SANTO_TOME_CENTER = { lat: -28.5489, lng: -56.0411 };

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
  const autocompleteRef = useRef(null);

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
      const geocoder = new window.google.maps.Geocoder();
      const fullAddress = `${initialAddress}, Santo Tomé, Corrientes, Argentina`;
      geocoder.geocode({ address: fullAddress, componentRestrictions: { country: 'AR' } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const { lat, lng } = results[0].geometry.location;
          const newPos = { lat: lat(), lng: lng() };
          setPosition(newPos);
          setAddress(results[0].formatted_address);
        }
      });
    }
  }, [isLoaded, initialAddress, initialCoords]);

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setPosition(newPos);
        setAddress(place.formatted_address || '');
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
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: newPos }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address);
      }
    });
  };

  const handleManualGeocode = () => {
    if (!address || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    const fullAddress = address.includes('Santo Tomé') ? address : `${address}, Santo Tomé, Corrientes, Argentina`;
    
    geocoder.geocode({ 
      address: fullAddress, 
      componentRestrictions: { country: 'AR' } 
    }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        const newPos = { lat: lat(), lng: lng() };
        setPosition(newPos);
        setAddress(results[0].formatted_address);
        if (map) map.panTo(newPos);
      }
    });
  };

  const handleConfirm = () => {
    if (!isValidArea) return;
    onConfirm({
      address,
      lat: position.lat,
      lng: position.lng,
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
                locationBias: { radius: 10000, center: SANTO_TOME_CENTER },
                fields: ['address_components', 'geometry', 'icon', 'name', 'formatted_address']
              }}
            >
              <input
                type="text"
                placeholder={title.includes('Local') ? "Ubicación de tu negocio..." : "Escribí tu calle y número..."}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={handleManualGeocode}
                onKeyDown={(e) => e.key === 'Enter' && handleManualGeocode()}
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
            disabled={!isValidArea || !address}
          >
            Confirmar Ubicación
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressSelector;
