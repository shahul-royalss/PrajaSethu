import Link from 'next/link';
import { ReactNode } from 'react';
import { Logo } from './Logo';
import { BackButton, HomeButton } from './AppNav';

export function Header({ title, subtitle, right, backHref }: { title?: string; subtitle?: string; right?: ReactNode; backHref?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-1.5">
          <BackButton fallback={backHref} />
          <Link href="/" className="flex items-center gap-2">
            <Logo size={34} />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {title && <span className="hidden text-sm font-semibold text-slate-600 sm:block">{title}</span>}
          {right}
          <HomeButton />
        </div>
      </div>
    </header>
  );
}
