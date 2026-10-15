import React, { useEffect, useState } from 'react';
import { authApi, tokenStorage } from '../api/client';
import { AuthContext } from './authContextDef';
import type { UserLoginRequest, UserRegisterRequest, UserResponse } from '../types';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate stored token on mount
  useEffect(() => {
    let ignore = false;

    const checkSession = async () => {
      const storedToken = tokenStorage.get();
      if (!storedToken) {
        if (!ignore) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await authApi.getMe();
        if (!ignore) {
          setUser(currentUser);
          setToken(storedToken);
        }
      } catch {
        // Token is invalid, expired, or revoked
        tokenStorage.remove();
        if (!ignore) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      ignore = true;
    };
  }, []);

  // Synchronize authentication state on 401 unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gamerbrac:auth-unauthorized', handleUnauthorized);
      return () => {
        window.removeEventListener('gamerbrac:auth-unauthorized', handleUnauthorized);
      };
    }
  }, []);

  const login = async (data: UserLoginRequest) => {
    const res = await authApi.login(data);
    tokenStorage.set(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const register = async (data: UserRegisterRequest) => {
    const res = await authApi.register(data);
    tokenStorage.set(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch {
      // Ignore network failure on logout; ensure local session is purged
    } finally {
      tokenStorage.remove();
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch {
      // Ignore fetch error if session lost
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
