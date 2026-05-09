import { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setUser({
        id: userId,
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || '',
        address: localStorage.getItem('userAddress') || '',
        telefono: localStorage.getItem('userTelefono') || '',
        emailConfirmado: localStorage.getItem('userEmailConfirmado') === 'true',
        role: localStorage.getItem('userRole') || 'user',
      });
    }
    const localToken = localStorage.getItem('localToken');
    if (localToken) {
      setRestaurant({ 
        id: localToken,
        emailConfirmado: localStorage.getItem('localEmailConfirmado') === 'true'
      });
    }
    const repartidorId = localStorage.getItem('repartidorId');
    if (repartidorId) {
      setDriver({ 
        id: repartidorId,
        emailConfirmado: localStorage.getItem('driverEmailConfirmado') === 'true'
      });
    }
  }, []);

  const loginAsUser = (data) => {
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userName', data.name || '');
    localStorage.setItem('userEmail', data.email || '');
    localStorage.setItem('userAddress', data.address || '');
    localStorage.setItem('userTelefono', data.telefono || '');
    localStorage.setItem('userEmailConfirmado', String(!!data.emailConfirmado));
    localStorage.setItem('userRole', data.role || 'user');
    setUser({ 
      id: data.userId, 
      name: data.name, 
      email: data.email, 
      address: data.address,
      telefono: data.telefono,
      emailConfirmado: !!data.emailConfirmado,
      role: data.role || 'user'
    });
  };

  const logoutUser = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase logout error:", e);
    }
    ['userId', 'userName', 'userEmail', 'userAddress', 'userTelefono', 'userEmailConfirmado', 'userRole'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // Sincronizar con Supabase
      const dbUser = await api.syncFirebaseUser(firebaseUser);
      
      if (dbUser.success) {
        loginAsUser({
          userId: dbUser.userId,
          name: dbUser.nombre,
          email: dbUser.email,
          address: dbUser.direccion,
          telefono: dbUser.telefono,
          emailConfirmado: dbUser.emailConfirmado,
          role: dbUser.role
        });
        return { success: true, isNew: dbUser.isNew };
      }
      return { success: false, error: 'Error al sincronizar con la base de datos' };
    } catch (error) {
      console.error("Error en login con Google:", error);
      return { success: false, error: error.message };
    }
  };

  const loginAsRestaurant = (data) => {
    const localId = typeof data === 'string' ? data : data.localId;
    const confirmed = typeof data === 'object' ? !!data.emailConfirmado : (localStorage.getItem('localEmailConfirmado') === 'true');
    
    localStorage.setItem('localToken', localId);
    localStorage.setItem('localEmailConfirmado', String(confirmed));
    setRestaurant({ id: localId, emailConfirmado: confirmed });
  };

  const logoutRestaurant = () => {
    ['localToken', 'localEmailConfirmado'].forEach(k => localStorage.removeItem(k));
    setRestaurant(null);
  };

  const loginAsDriver = (data) => {
    const id = typeof data === 'string' ? data : (data.ID || data.id);
    const confirmed = typeof data === 'object' ? !!(data.EmailConfirmado || data.emailConfirmado) : (localStorage.getItem('driverEmailConfirmado') === 'true');

    localStorage.setItem('repartidorId', id);
    localStorage.setItem('driverEmailConfirmado', String(confirmed));
    setDriver({ id, emailConfirmado: confirmed });
  };

  const logoutDriver = () => {
    ['repartidorId', 'driverEmailConfirmado'].forEach(k => localStorage.removeItem(k));
    setDriver(null);
  };

  const updateUserAddress = (address) => {
    localStorage.setItem('userAddress', address);
    setUser(prev => prev ? { ...prev, address } : null);
  };

  return (
    <AuthContext.Provider value={{
      user, restaurant, driver,
      loginAsUser, logoutUser, loginWithGoogle,
      loginAsRestaurant, logoutRestaurant,
      loginAsDriver, logoutDriver,
      updateUserAddress,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
