'use client';

// App-style navigation, shared by the web site and the mobile-app WebView (which
// has no browser chrome): Back/Home controls for page headers, plus a global
// bottom tab bar (BottomNav) with role-aware quick links — including the GIS
// heatmap for staff. The mobile wrapper can open any URL with ?app=1 to keep the
// tab bar visible at every viewport width for the session.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/intl';
import { SESSION_EVENT, getCitizen, getCitizenToken, getOfficer, getToken } from '../lib/session';
import { canSeeView } from './console/nav';

// Walk real history when there is any (so console views unwind one by one inside
// a WebView), otherwise land on a sensible page instead of doing nothing.
// history.length alone can't tell "at the first entry with forward entries" from
// "has a previous entry", so prefer the Navigation API where it exists
// (Chrome / Android WebView) and keep the length heuristic as the fallback.
export function smartBack(fallback = '/') {
  if (typeof window === 'undefined') return;
  const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
  const canGoBack = typeof nav?.canGoBack === 'boolean' ? nav.canGoBack : window.history.length > 1;
  if (canGoBack) window.history.back();
  else window.location.assign(fallback);
}

type Audience = 'guest' | 'citizen' | 'staff';

function readAudience(): { audience: Audience; role: string } {
  const officer = getToken() ? getOfficer() : null;
  if (officer) return { audience: 'staff', role: officer.role };
  if (getCitizenToken() && getCitizen()) return { audience: 'citizen', role: '' };
  return { audience: 'guest', role: '' };
}

export function homeFor(audience: Audience): string {
  return audience === 'staff' ? '/staff' : audience === 'citizen' ? '/citizen' : '/';
}

// Session lives in localStorage, so re-read it after every navigation and on the
// SESSION_EVENT that lib/session fires for in-place sign-in/out (LoginGate does
// not navigate). Returns null until mounted so SSR and first client render match.
function useAudience() {
  const pathname = usePathname();
  const [who, setWho] = useState<{ audience: Audience; role: string } | null>(null);
  useEffect(() => {
    const read = () => setWho(readAudience());
    read();
    window.addEventListener(SESSION_EVENT, read);
    return () => window.removeEventListener(SESSION_EVENT, read);
  }, [pathname]);
  return who;
}

const ICON_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';

export function BackButton({ fallback, className }: { fallback?: string; className?: string }) {
  const { t } = useI18n();
  const who = useAudience();
  const fb = fallback ?? (who ? homeFor(who.audience) : '/');
  return (
    <button
      type="button"
      aria-label={t('back')}
      title={t('back')}
      className={className ?? ICON_BTN}
      onClick={() => smartBack(fb)}
    >
      <NavIcon name="back" className="h-5 w-5" />
    </button>
  );
}

export function HomeButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const who = useAudience();
  // '/' already routes signed-in users to their home, so it is a safe default
  // for SSR/first paint; once the session is read we link straight there.
  const href = who ? homeFor(who.audience) : '/';
  return (
    <Link href={href} aria-label={t('navHome')} title={t('navHome')} className={className ?? ICON_BTN}>
      <NavIcon name="home" className="h-5 w-5" />
    </Link>
  );
}

// ── Bottom app bar ───────────────────────────────────────────────────────────

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams();
  const who = useAudience();
  const [appMode, setAppMode] = useState(false);

  const hidden = pathname === '/' || pathname.startsWith('/citizen/new'); // immersive full-screen surfaces

  const appParam = search.get('app');
  useEffect(() => {
    if (appParam === '1') sessionStorage.setItem('saarthi_app', '1');
    setAppMode(sessionStorage.getItem('saarthi_app') === '1');
  }, [appParam]);

  // Mirror the "bar is visible at every width" state onto <html> so plain CSS
  // (e.g. the console rail height in console.css) can make room for the bar
  // wherever it is actually shown, not just below the md breakpoint.
  useEffect(() => {
    document.documentElement.classList.toggle('saarthi-app-nav', appMode && !hidden);
    return () => document.documentElement.classList.remove('saarthi-app-nav');
  }, [appMode, hidden]);

  if (!who || hidden) return null;

  const { audience, role } = who;
  const view = search.get('view');
  const homeHref = homeFor(audience);
  // Keep the app-mode marker in tab URLs so a restored WebView (fresh
  // sessionStorage) re-enters app mode from the URL alone.
  const withApp = (href: string) => (appMode ? `${href}${href.includes('?') ? '&' : '?'}app=1` : href);

  const homeTab = {
    key: 'home',
    label: t('navHome'),
    icon: 'home' as const,
    href: homeHref,
    active:
      audience === 'staff'
        ? pathname === '/staff' && (!view || view === 'overview' || view === 'workbench')
        : pathname === homeHref,
  };
  const tabs =
    audience === 'staff' && canSeeView(role, 'gis')
      ? [
          homeTab,
          { key: 'heatmap', label: t('navHeatmap'), icon: 'map' as const, href: '/staff?view=gis', active: pathname === '/staff' && view === 'gis' },
          { key: 'analytics', label: t('navAnalytics'), icon: 'chart' as const, href: '/staff?view=analytics', active: pathname === '/staff' && view === 'analytics' },
        ]
      : audience === 'staff'
        ? [
            homeTab,
            { key: 'console', label: t('navConsole'), icon: 'console' as const, href: '/console', active: pathname === '/console' },
            { key: 'track', label: t('navTrack'), icon: 'track' as const, href: '/track', active: pathname.startsWith('/track') },
          ]
        : [
            homeTab,
            { key: 'new', label: t('navNew'), icon: 'new' as const, href: '/citizen/new', active: false },
            { key: 'track', label: t('navTrack'), icon: 'track' as const, href: '/track', active: pathname.startsWith('/track') },
          ];

  // z-20 keeps the bar above page content but below sticky headers (z-30), so
  // header dropdowns (LanguageSwitcher) and their click-away overlays win.
  const vis = appMode ? '' : ' md:hidden';
  const tabCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-brand' : 'text-slate-500'}`;

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers the end of the page */}
      <div className={`h-[calc(4rem+env(safe-area-inset-bottom))]${vis}`} aria-hidden />
      <nav
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(9,22,51,0.08)] backdrop-blur${vis}`}
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          <button type="button" onClick={() => smartBack(homeHref)} className={tabCls(false)}>
            <NavIcon name="back" className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{t('back')}</span>
          </button>
          {tabs.map((tab) => (
            <Link key={tab.key} href={withApp(tab.href)} aria-current={tab.active ? 'page' : undefined} className={tabCls(tab.active)}>
              <NavIcon name={tab.icon} className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

// ── icons ────────────────────────────────────────────────────────────────────
// Self-contained inline SVGs: the console's <IconSprite> is only mounted inside
// the console root, while these controls render on every page.

type NavIconName = 'back' | 'home' | 'new' | 'track' | 'map' | 'chart' | 'console';

function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const p = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'back':
      return <svg {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
    case 'home':
      return <svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg>;
    case 'new':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
    case 'track':
      return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case 'map':
      return <svg {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>;
    case 'chart':
      return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case 'console':
      return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  }
}
