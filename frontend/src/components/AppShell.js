'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppProvider, useApp } from '../context/AppContext';
import { Home, Plus, Scale, BarChart3, FolderHeart, Settings, WifiOff, Loader2 } from 'lucide-react';

const InnerShell = ({ children }) => {
  const pathname = usePathname();
  const { user, isLoading, isOffline } = useApp();

  // If initial load is running, display a beautiful dark-mode loading spinner
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 px-6">
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Loader2 className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-semibold tracking-wider font-display text-indigo-200">KHARCH</h2>
        <p className="text-sm text-slate-400 mt-1 animate-pulse">Synchronizing your balances...</p>
      </div>
    );
  }

  const isLoginPage = pathname === '/login';

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Offline Status Warning Bar */}
      {isOffline && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-slide-down">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span className="font-medium text-center">
            You're offline. Previously cached summaries are readable, reconnect to post new movements.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-24 ${isLoginPage ? 'pb-4' : ''}`}>
        {children}
      </main>

      {/* Premium Mobile Bottom Navigation */}
      {user && !isLoginPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-4 pb-safe-bottom">
          <div className="flex justify-between items-center max-w-md mx-auto h-16">
            <Link 
              href="/" 
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/' ? 'text-indigo-400 scale-105' : 'text-slate-400 active:scale-95'}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Home</span>
            </Link>

            <Link 
              href="/reconcile" 
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/reconcile' ? 'text-indigo-400 scale-105' : 'text-slate-400 active:scale-95'}`}
            >
              <Scale className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Reconcile</span>
            </Link>

            {/* Special Large Central Add Action */}
            <div className="flex-1 flex justify-center -mt-6">
              <Link 
                href="/add" 
                className="flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-full shadow-lg shadow-indigo-500/20 text-white hover:from-indigo-600 hover:to-violet-700 active:scale-95 transition-all duration-200"
              >
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </Link>
            </div>

            <Link 
              href="/analytics" 
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/analytics' ? 'text-indigo-400 scale-105' : 'text-slate-400 active:scale-95'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Analytics</span>
            </Link>

            <Link 
              href="/spaces" 
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/spaces' ? 'text-indigo-400 scale-105' : 'text-slate-400 active:scale-95'}`}
            >
              <FolderHeart className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Spaces</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
};

export default function AppShell({ children }) {
  return (
    <AppProvider>
      <InnerShell>{children}</InnerShell>
    </AppProvider>
  );
}
