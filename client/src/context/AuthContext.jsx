import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../api/services';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'rms_token';
const USER_KEY = 'rms_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const saveSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(
    async (payload) => {
      const response = await authService.login(payload);
      saveSession(response.token, response.user);
      return response;
    },
    [saveSession]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    setLoading(true);
    try {
      const profile = await authService.profile();
      setUser(profile);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return profile;
    } catch (error) {
      clearSession();
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, clearSession]);

  useEffect(() => {
    if (token && (!user || !Array.isArray(user.permissions))) {
      refreshProfile();
    }
  }, [token, user, refreshProfile]);

  const value = useMemo(
    () => ({ token, user, loading, isAuthenticated: Boolean(token), login, logout, refreshProfile }),
    [token, user, loading, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
