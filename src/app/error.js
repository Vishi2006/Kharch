'use client';

export default function ErrorBoundary({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <h2 className="text-xl font-bold text-white">Something went wrong!</h2>
      <p className="text-sm text-slate-400 mt-2">
        {error?.message || 'An unexpected client error occurred.'}
      </p>
      <button
        onClick={() => reset?.()}
        className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
      >
        Try Again
      </button>
    </div>
  );
}
