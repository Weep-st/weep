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
      });
    }
    const localToken = localStorage.getItem('localToken');
    if (localToken) setRestaurant({ id: localToken });
    const repartidorId = localStorage.getItem('repartidorId');
    if (repartidorId) setDriver({ id: repartidorId });
  }, []);

  const loginAsUser = (data) => {
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userName', data.name || '');
    localStorage.setItem('userEmail', data.email || '');
    localStorage.setItem('userAddress', data.address || '');
    setUser({ id: data.userId, name: data.name, email: data.email, address: data.address });
  };

  const logoutUser = () => {
    ['userId', 'userName', 'userEmail', 'userAddress'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const loginAsRestaurant = (localId) => {
    localStorage.setItem('localToken', localId);
    setRestaurant({ id: localId });
  };

  const logoutRestaurant = () => {
    localStorage.removeItem('localToken');
    setRestaurant(null);
  };

  const loginAsDriver = (id) => {
    localStorage.setItem('repartidorId', id);
    setDriver({ id });
  };

  const logoutDriver = () => {
    localStorage.removeItem('repartidorId');
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
