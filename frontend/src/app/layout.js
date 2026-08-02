import './globals.css';
import AppShell from '../components/AppShell';
import Script from 'next/script';

export const metadata = {
  title: 'Kharch | Personal Finance PWA',
  description: 'Track expenses, manage budgets, and reconciliate monthly cashflow easily.',
  manifest: '/manifest.json',
  appleMobileWebAppCapable: 'yes',
  appleMobileWebAppStatusBarStyle: 'black-translucent',
};

export const dynamic = 'force-dynamic';

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              if (typeof SVGElement !== 'undefined') {
                const desc = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'className');
                if (desc && desc.get) {
                  Object.defineProperty(SVGElement.prototype, 'className', {
                    get() {
                      const val = desc.get.call(this);
                      if (val && typeof val === 'object') {
                        val.match = val.match || (function(regex) { return (val.baseVal || '').match(regex); });
                        val.indexOf = val.indexOf || (function(str) { return (val.baseVal || '').indexOf(str); });
                        val.includes = val.includes || (function(str) { return (val.baseVal || '').includes(str); });
                      }
                      return val;
                    },
                    configurable: true
                  });
                }
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="font-sans bg-slate-950 text-slate-100 min-h-screen antialiased select-none overflow-x-hidden pb-20">
        <AppShell>{children}</AppShell>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
