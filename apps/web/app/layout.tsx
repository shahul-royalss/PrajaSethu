import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import './console.css';
import './auth.css';
import { Providers } from './providers';
import { BottomNav } from './components/AppNav';

export const metadata: Metadata = {
  title: 'SAARTHI — Public Grievance Redressal · Government of India',
  description:
    'SAARTHI — a voice-first, multilingual, tamper-evident Public Grievance Redressal System. File and track grievances in your own language. Government of India pilot.',
};

// viewport-fit=cover lets the bottom app bar extend under notches / gesture bars
// (padded back out with env(safe-area-inset-bottom)) when embedded in the app.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D2150',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts loaded at runtime via <link> (not next/font) so builds never need network. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          {children}
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
