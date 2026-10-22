'use client';

import React from 'react';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 font-sans min-h-screen flex flex-col items-center justify-center px-6 text-center select-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl flex flex-col items-center">
          {/* Inline SVG Shield Alert Icon */}
          <div className="p-4 bg-rose-500/10 rounded-2xl mb-4 border border-rose-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white">Something went wrong!</h2>
          
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            A fatal client error occurred. We have sandboxed your session to protect your ledger data.
          </p>

          {error && (
            <div className="w-full mt-4 p-3 bg-slate-950 rounded-xl text-left border border-slate-850 font-mono text-[9px] text-slate-500 overflow-x-auto max-h-24">
              {error.message || String(error)}
            </div>
          )}

          <button
            onClick={() => reset()}
            className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 rounded-xl shadow transition-all cursor-pointer"
          >
            Try Reloading Session
          </button>
        </div>
      </body>
    </html>
  );
}
