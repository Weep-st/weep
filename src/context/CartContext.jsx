import { createContext, useContext, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext(null);
const COSTO_ENVIO = 2500;

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [deliveryType, setDeliveryType] = useState('envio');

  const addItem = useCallback((menu) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === menu.id);
      if (existing) {
        toast.success(`${menu.nombre} × ${existing.qty + 1}`);
        return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + 1 } : i);
      }
      toast.success(`${menu.nombre} agregado`);
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
  const shippingCost = deliveryType === 'retiro' ? 0 : (hasDrink ? 0 : COSTO_ENVIO);
  const total = subtotal + shippingCost;
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQty, clearCart,
      deliveryType, setDeliveryType,
      subtotal, shippingCost, total, totalItems, hasDrink,
      COSTO_ENVIO,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
