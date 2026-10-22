'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  cacheSpaces, 
  getCachedSpaces, 
  cacheDashboard, 
  getCachedDashboard, 
  enqueueSync,
  db
} from '../utils/db';
import { flushPendingSyncQueue } from '../utils/syncQueue';

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
  const [isBackendSyncing, setIsBackendSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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
        setUser(null);
        localStorage.removeItem('cachedUser');
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

  // Offline-safe mutation helper
  const offlineSafeFetch = useCallback(async (endpoint, options = {}) => {
    if (!navigator.onLine) {
      await enqueueSync(endpoint, options.method || 'POST', options.body);
      const remaining = await db.pendingSync.count();
      setPendingSyncCount(remaining);
      return { success: true, offlineQueued: true };
    }

    const res = await apiFetch(endpoint, options);
    if (res && res.error && (res.status === 500 || res.status === 502 || res.status === 503 || res.error.includes('Network'))) {
      await enqueueSync(endpoint, options.method || 'POST', options.body);
      const remaining = await db.pendingSync.count();
      setPendingSyncCount(remaining);
      return { success: true, offlineQueued: true };
    }
    return res;
  }, [apiFetch]);

  // Refresh current dashboard details (SWR pattern)
  const refreshDashboard = useCallback(async (spaceId = activeSpaceId) => {
    if (!spaceId) return;

    // 1. Read from IndexedDB cache first
    const cached = await getCachedDashboard(spaceId);
    if (cached) {
      setDashboardData(cached);
    }

    // 2. Revalidate from backend in background
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const data = await apiFetch(`/api/transactions/dashboard?spaceId=${spaceId}&timezone=${tz}`);
    if (data && !data.error) {
      setDashboardData(data);
      await cacheDashboard(spaceId, data);
    }
  }, [apiFetch, activeSpaceId]);

  // Phase 5a: Waking sleeping Render backend on app open (non-blocking with exponential backoff)
  const wakeUpBackend = useCallback(async () => {
    setIsBackendSyncing(true);
    let delay = 2000;
    const maxWaitMs = 60000;
    const startTime = Date.now();

    const ping = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { keepalive: true });
        if (res.ok) {
          setIsBackendSyncing(false);
          // Flush pending sync queue
          await flushPendingSyncQueue(apiFetch);
          const remaining = await db.pendingSync.count();
          setPendingSyncCount(remaining);
          // Re-sync dashboard
          if (activeSpaceId) {
            refreshDashboard(activeSpaceId);
          }
          return;
        }
      } catch (_) {
        // Backend cold sleeping
      }

      if (Date.now() - startTime < maxWaitMs) {
        setTimeout(ping, delay);
        delay = Math.min(delay * 2, 16000); // 2s, 4s, 8s, 16s...
      } else {
        setIsBackendSyncing(false);
      }
    };

    ping();
  }, [API_BASE, activeSpaceId, apiFetch, refreshDashboard]);

  // Fetch all spaces for user
  const fetchSpaces = useCallback(async () => {
    // Read cached spaces first
    const cached = await getCachedSpaces();
    if (cached.length > 0) {
      setSpaces(cached);
    }

    const data = await apiFetch('/api/spaces');
    if (data && !data.error) {
      setSpaces(data);
      await cacheSpaces(data);

      const def = data.find((s) => s.isDefault) || data[0];
      if (def && !activeSpaceId) {
        setActiveSpaceId(def._id);
        localStorage.setItem('activeSpaceId', def._id);
      }
      return data;
    }
    return cached;
  }, [apiFetch, activeSpaceId]);

  // Initialize: verify authentication (Local-first read from cache)
  const checkAuth = useCallback(async () => {
    // 1. Read cached user from localStorage for instant render
    if (typeof window !== 'undefined') {
      const cachedUserStr = localStorage.getItem('cachedUser');
      if (cachedUserStr) {
        try {
          const parsed = JSON.parse(cachedUserStr);
          setUser(parsed);
          setIsLoading(false); // Shell renders immediately from cache!
        } catch (_) {}
      }

      const cachedSpaces = await getCachedSpaces();
      if (cachedSpaces.length > 0) {
        setSpaces(cachedSpaces);
        const savedSpaceId = localStorage.getItem('activeSpaceId') || cachedSpaces[0]._id;
        setActiveSpaceId(savedSpaceId);
        const cachedDash = await getCachedDashboard(savedSpaceId);
        if (cachedDash) {
          setDashboardData(cachedDash);
        }
      }
    }

    // 2. Verify with backend in background
    const data = await apiFetch('/api/auth/me');
    if (data && !data.error && data.user) {
      setUser(data.user);
      localStorage.setItem('cachedUser', JSON.stringify(data.user));

      const savedSpaceId = localStorage.getItem('activeSpaceId');
      const spacesList = await apiFetch('/api/spaces');
      if (spacesList && !spacesList.error) {
        setSpaces(spacesList);
        await cacheSpaces(spacesList);

        const hasSavedSpace = spacesList.some((s) => s._id === savedSpaceId);
        const def = spacesList.find((s) => s.isDefault) || spacesList[0];
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
    } else if (data && data.status === 401) {
      setUser(null);
      localStorage.removeItem('cachedUser');
      if (pathname !== '/login') {
        router.push('/login');
      }
    }
    setIsLoading(false);
  }, [apiFetch, pathname, router, refreshDashboard]);

  // Mount: start wake-up ping, auth check, and offline listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);

      const goOnline = () => {
        setIsOffline(false);
        wakeUpBackend();
      };
      const goOffline = () => setIsOffline(true);

      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);

      // Register Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('ServiceWorker registered:', reg.scope))
          .catch((err) => console.error('ServiceWorker registration failed:', err));
      }

      // Check pending sync count
      db.pendingSync.count().then((count) => setPendingSyncCount(count));

      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, [wakeUpBackend]);

  // Initial Auth & Wakeup
  useEffect(() => {
    checkAuth();
    wakeUpBackend();
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
      localStorage.setItem('cachedUser', JSON.stringify(data.user));
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
    localStorage.removeItem('cachedUser');
    setSpaces([]);
    setActiveSpaceId(null);
    setDashboardData(null);
    router.push('/login');
    setIsLoading(false);
  };

  const activeSpace = spaces.find((s) => s._id === activeSpaceId);

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
        isBackendSyncing,
        pendingSyncCount,
        API_BASE,
        apiFetch,
        offlineSafeFetch,
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
        insight: 'Prerendering dashboard metrics...',
      },
      isOffline: false,
      isLoading: true,
      isBackendSyncing: false,
      pendingSyncCount: 0,
      API_BASE: '',
      apiFetch: async () => ({}),
      offlineSafeFetch: async () => ({ success: true }),
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
