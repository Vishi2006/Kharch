'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Define backend URL. In dev, points to localhost:5000. In production, empty string (relative) or Render URL
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  // Helper fetch with credentials
  const apiFetch = useCallback(async (endpoint, options = {}) => {
    options.credentials = 'include';
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Resolve absolute path if necessary
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, options);
      if (response.status === 401) {
        // Not authorized - wipe local user and redirect to login
        setUser(null);
        if (pathname !== '/login') {
          router.push('/login');
        }
        return { error: 'Unauthorized', status: 401 };
      }
      const data = await response.json();
      if (!response.ok) {
        return { error: data.message || 'API request failed', status: response.status };
      }
      return data;
    } catch (error) {
      console.error(`API Fetch Error [${endpoint}]:`, error);
      return { error: 'Network error', status: 500 };
    }
  }, [API_BASE, pathname, router]);

  // Offline status listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      const goOnline = () => setIsOffline(false);
      const goOffline = () => setIsOffline(true);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      
      // Register Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('ServiceWorker registered:', reg.scope))
          .catch((err) => console.error('ServiceWorker registration failed:', err));
      }

      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, []);

  // Fetch all spaces for user
  const fetchSpaces = useCallback(async () => {
    const data = await apiFetch('/api/spaces');
    if (data && !data.error) {
      setSpaces(data);
      // Select default space if none active
      const def = data.find(s => s.isDefault) || data[0];
      if (def && !activeSpaceId) {
        setActiveSpaceId(def._id);
        localStorage.setItem('activeSpaceId', def._id);
      }
      return data;
    }
    return [];
  }, [apiFetch, activeSpaceId]);

  // Refresh current dashboard details
  const refreshDashboard = useCallback(async (spaceId = activeSpaceId) => {
    if (!spaceId) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const data = await apiFetch(`/api/transactions/dashboard?spaceId=${spaceId}&timezone=${tz}`);
    if (data && !data.error) {
      setDashboardData(data);
    }
  }, [apiFetch, activeSpaceId]);

  // Initialize: verify authentication
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    const data = await apiFetch('/api/auth/me');
    if (data && !data.error && data.user) {
      setUser(data.user);
      
      // Load last used space ID from local storage
      const savedSpaceId = localStorage.getItem('activeSpaceId');
      
      // Fetch spaces list
      const spacesList = await apiFetch('/api/spaces');
      if (spacesList && !spacesList.error) {
        setSpaces(spacesList);
        const hasSavedSpace = spacesList.some(s => s._id === savedSpaceId);
        const def = spacesList.find(s => s.isDefault) || spacesList[0];
        
        const spaceToUse = hasSavedSpace ? savedSpaceId : (def ? def._id : null);
        if (spaceToUse) {
          setActiveSpaceId(spaceToUse);
          localStorage.setItem('activeSpaceId', spaceToUse);
          await refreshDashboard(spaceToUse);
        }
      }
      
      if (pathname === '/login') {
        router.push('/');
      }
    } else {
      setUser(null);
      if (pathname !== '/login') {
        router.push('/login');
      }
    }
    setIsLoading(false);
  }, [apiFetch, pathname, router, refreshDashboard]);

  // Trigger Auth check once on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Sync dashboard when active space changes
  useEffect(() => {
    if (user && activeSpaceId) {
      refreshDashboard(activeSpaceId);
    }
  }, [activeSpaceId, user]);

  // Action: Switch Active Space
  const switchSpace = (spaceId) => {
    setActiveSpaceId(spaceId);
    localStorage.setItem('activeSpaceId', spaceId);
  };

  // Action: Google Auth Login
  const login = async (credential) => {
    setIsLoading(true);
    const data = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });

    if (data && !data.error && data.user) {
      setUser(data.user);
      await fetchSpaces();
      if (data.defaultSpaceId) {
        setActiveSpaceId(data.defaultSpaceId);
        localStorage.setItem('activeSpaceId', data.defaultSpaceId);
      }
      router.push('/');
      setIsLoading(false);
      return { success: true };
    } else {
      setIsLoading(false);
      return { success: false, error: data?.error || 'Login failed' };
    }
  };

  // Action: Logout
  const logout = async () => {
    setIsLoading(true);
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setSpaces([]);
    setActiveSpaceId(null);
    setDashboardData(null);
    router.push('/login');
    setIsLoading(false);
  };

  const activeSpace = spaces.find(s => s._id === activeSpaceId);

  return (
    <AppContext.Provider
      value={{
        user,
        spaces,
        activeSpaceId,
        activeSpace,
        dashboardData,
        isOffline,
        isLoading,
        API_BASE,
        apiFetch,
        fetchSpaces,
        refreshDashboard,
        switchSpace,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    // Return safe fallback for static build time pre-rendering
    return {
      user: null,
      spaces: [],
      activeSpaceId: null,
      activeSpace: null,
      dashboardData: {
        openingBalance: 0,
        currentBalance: 0,
        monthEarned: 0,
        monthSpent: 0,
        monthInvestments: 0,
        monthSavings: 0,
        todaySpent: 0,
        todayImportance: { essential: 0, moderate: 0, low_value: 0 },
        recentTransactions: [],
        insight: 'Prerendering dashboard metrics...'
      },
      isOffline: false,
      isLoading: true,
      API_BASE: '',
      apiFetch: async () => ({}),
      fetchSpaces: async () => [],
      refreshDashboard: async () => {},
      switchSpace: () => {},
      login: async () => ({ success: false }),
      logout: async () => {},
      checkAuth: async () => {},
    };
  }
  return context;
};
