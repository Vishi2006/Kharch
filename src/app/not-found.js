'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl flex flex-col items-center">
        <div className="p-4 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
          <HelpCircle className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>

        <h2 className="text-xl font-bold font-display text-white">Page Not Found</h2>
        
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The dashboard segment you are trying to view does not exist or has been archived.
        </p>

        <Link
          href="/"
          className="w-full mt-6 py-3 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow transition-all cursor-pointer"
        >
          Return to Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
