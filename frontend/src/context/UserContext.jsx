import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/axios';

const UserContext = createContext({});

const STORAGE_KEY = 'seprojeto:user';

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Não foi possível carregar o utilizador armazenado.', error);
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Não foi possível sincronizar o utilizador no storage.', error);
    }
  }, [user]);

  const refreshUser = async () => {
    if (!user) return null;
    setLoading(true);
    try {
      const { data } = await api.get(`users/${user.id}/`);
      setUser(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      clearUser: () => setUser(null),
      refreshUser,
      loading,
    }),
    [user, loading],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser deve ser usado dentro de UserProvider');
  }
  return ctx;
};
