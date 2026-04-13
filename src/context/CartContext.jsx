import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as api from '../services/api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [deliveryType, setDeliveryType] = useState('envio');
  const [costoEnvio, setCostoEnvio] = useState(1800); 
  const [incentivoActivo, setIncentivoActivo] = useState(0);

  useEffect(() => {
    const fetchCosto = async () => {
      try {
        // Consultamos el incentivo dinámico y la configuración base
        const [config, activation] = await Promise.all([
          api.getConfiguracion(),
          api.getSystemActivation()
        ]);

        const base = Number(config?.valor_envio) || 1800;
        const incentivo = Number(activation?.valor_incentivo) || 0;

        setCostoEnvio(base + incentivo);
        setIncentivoActivo(incentivo);
      } catch (err) {
        console.error('Error fetching dynamic shipping cost:', err);
        setCostoEnvio(1800);
      }
    };
    
    fetchCosto();
    
    // Opcional: Refrescar cada 2 minutos para reflejar cambios de tarifa
    const interval = setInterval(fetchCosto, 120000);
    return () => clearInterval(interval);
  }, []);

  const addItem = useCallback((menu) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === menu.id);
      if (existing) {
        return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...menu, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id, delta) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
  const hasDrink = items.some(i => i.categoria?.toLowerCase().includes('bebida'));
  
  const shippingCost = deliveryType === 'retiro' ? 0 : costoEnvio;
  const total = subtotal + shippingCost;
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQty, clearCart,
      deliveryType, setDeliveryType,
      subtotal, shippingCost, total, totalItems, hasDrink,
      COSTO_ENVIO: costoEnvio,
      incentivoActivo
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
