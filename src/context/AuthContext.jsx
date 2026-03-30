import { createContext, useContext, useState, useEffect } from 'react';

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
        emailConfirmado: localStorage.getItem('userEmailConfirmado') === 'true',
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
    localStorage.setItem('userEmailConfirmado', String(!!data.emailConfirmado));
    setUser({ 
      id: data.userId, 
      name: data.name, 
      email: data.email, 
      address: data.address,
      emailConfirmado: !!data.emailConfirmado 
    });
  };

  const logoutUser = () => {
    ['userId', 'userName', 'userEmail', 'userAddress', 'userEmailConfirmado'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const loginAsRestaurant = (data) => {
    const id = typeof data === 'string' ? data : data.localId;
    const confirmed = typeof data === 'object' ? !!data.emailConfirmado : (localStorage.getItem('localEmailConfirmado') === 'true');
    
    localStorage.setItem('localToken', id);
    localStorage.setItem('localEmailConfirmado', String(confirmed));
    setRestaurant({ id, emailConfirmado: confirmed });
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
      loginAsUser, logoutUser,
      loginAsRestaurant, logoutRestaurant,
      loginAsDriver, logoutDriver,
      updateUserAddress,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
