import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface User {
  id: number;
  first_name: string;
  username?: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const hasToken = apiClient.isLoggedIn();
    if (hasToken) {
      setIsAuthenticated(true);
      // We could optionally fetch user profile here if needed, 
      // but for now we'll assume the token is valid until a request 401s
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
    setIsLoading(false);
  };

  const login = async (password: string) => {
    try {
      const response = await apiClient.login(password);
      if (response.success) {
        setIsAuthenticated(true);
        setUser(response.user);
        localStorage.setItem('auth_user', JSON.stringify(response.user));
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = () => {
    apiClient.logout();
    localStorage.removeItem('auth_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout
  };
}