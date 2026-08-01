'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useApp();
  const [error, setError] = useState('');

  // Slider interaction state
  const [slideX, setSlideX] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [startX, setStartX] = useState(0);

  const maxSlide = 228; // 280px (track) - 44px (handle) - 8px (padding)

  // Handle Google ID Token response
  const handleCredentialResponse = async (response) => {
    setError('');
    const result = await login(response.credential);
    if (!result.success) {
      setError(result.error || 'Failed to authenticate with Google.');
      // Reset slider on login error to let user retry
      setSlideX(0);
      setIsUnlocked(false);
    }
  };

  useEffect(() => {
    // Check if google SDK is loaded, if not wait a bit
    const initGoogleAuth = () => {
      if (typeof window !== 'undefined' && window.google) {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy_client_id';
        
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        const btnContainer = document.getElementById('google-signin-btn');
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 280,
          });
        }
      } else {
        setTimeout(initGoogleAuth, 500);
      }
    };

    initGoogleAuth();
  }, [login]);

  // Global mouse/touch move event handlers for dragging the slider handle
  const handleStart = (clientX) => {
    if (isUnlocked) return;
    setIsSliding(true);
    setStartX(clientX - slideX);
  };

  const handleMove = (clientX) => {
    if (!isSliding || isUnlocked) return;
    const currentX = clientX - startX;
    const boundedX = Math.max(0, Math.min(maxSlide, currentX));
    setSlideX(boundedX);

    if (boundedX >= maxSlide) {
      setIsUnlocked(true);
      setIsSliding(false);
    }
  };

  const handleEnd = () => {
    if (!isSliding) return;
    setIsSliding(false);
    if (slideX < maxSlide) {
      setSlideX(0);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMove(e.clientX);
    const handleGlobalMouseUp = () => handleEnd();
    const handleGlobalTouchMove = (e) => handleMove(e.touches[0].clientX);
    const handleGlobalTouchEnd = () => handleEnd();

    if (isSliding) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isSliding, startX, slideX]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Visual background gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Glassmorphic Login Card */}
      <div className="w-full max-w-sm bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
        {/* Personalized Gold Logo */}
        <div className="w-24 h-24 mb-6 relative hover:scale-105 transition-transform duration-300">
          <img 
            src="/logo.png" 
            alt="Kharch App Logo" 
            className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(99,102,241,0.2)] rounded-3xl"
          />
        </div>

        {/* Casing & Branding */}
        <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-indigo-200 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Kharch
        </h1>
        <p className="text-sm text-slate-400 mt-2 font-medium">
          Where did your money go?
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
          Personal budget tracking, importance aggregates, and cashflow reconciliation.
        </p>

        {/* Error Message banner */}
        {error && (
          <div className="w-full mt-6 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-xl flex items-start gap-2 text-left text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Authentication Options container */}
        <div className="mt-8 flex flex-col items-center w-full min-h-[56px] justify-center relative">
          {/* Slider track (visible when locked) */}
          <div className={`relative w-[280px] h-[52px] bg-slate-950/80 border border-slate-850 rounded-full flex items-center p-1 select-none shadow-inner transition-all duration-300 ${
            isUnlocked ? 'opacity-0 scale-90 pointer-events-none absolute' : 'opacity-100 scale-100'
          }`}>
            {/* The slide track background indicator */}
            <div 
              style={{ width: `${(slideX / maxSlide) * 100}%` }}
              className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 rounded-full transition-all duration-75"
            />

            {/* Slide message */}
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none pl-10">
              Slide to Sign In
            </span>

            {/* Sliding handle button */}
            <div
              style={{ transform: `translateX(${slideX}px)` }}
              onMouseDown={(e) => handleStart(e.clientX)}
              onTouchStart={(e) => handleStart(e.touches[0].clientX)}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing z-10 transition-transform duration-0"
            >
              {/* Google multi-colored SVG */}
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
          </div>

          {/* Custom Tap Text Button (visible when unlocked) */}
          <div className={`relative w-[280px] h-[52px] rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-widest flex items-center justify-center shadow-lg transition-all duration-350 select-none ${
            isUnlocked 
              ? 'opacity-100 scale-100 pointer-events-auto' 
              : 'opacity-0 scale-90 pointer-events-none absolute'
          }`}>
            <span>Tap to Sign In</span>

            {/* Overlay invisible official Google button to catch the click */}
            <div 
              id="google-signin-btn"
              className="absolute inset-0 flex justify-center items-center opacity-[0.01] pointer-events-auto z-20 cursor-pointer w-full h-full"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] text-slate-600 font-medium">
          Secure authentication verified on the server.
        </p>
      </div>
    </div>
  );
}
