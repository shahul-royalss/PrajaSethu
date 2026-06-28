import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Praja Setu — Public Grievance Redressal (Pilot)',
  description:
    'Next-generation Public Grievance Redressal System for Andhra Pradesh — Telugu-first, voice-first, tamper-evident. Pilot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts loaded at runtime via <link> (not next/font) so builds never need network. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
