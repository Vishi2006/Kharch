'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white p-6 text-center font-sans">
        <h2 className="text-xl font-bold">Something went wrong!</h2>
        <p className="text-sm text-slate-400 mt-2">A client error occurred.</p>
        <button
          onClick={() => reset?.()}
          className="mt-4 px-4 py-2 bg-indigo-600 rounded-xl text-white font-bold cursor-pointer"
        >
          Try Reloading
        </button>
      </body>
    </html>
  );
}
