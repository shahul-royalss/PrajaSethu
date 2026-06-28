import Link from 'next/link';
import { ReactNode } from 'react';

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white font-bold" aria-hidden>
            ప
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">
              Praja Setu <span className="font-telugu text-slate-500">ప్రజా సేతు</span>
            </div>
            <div className="text-[11px] text-slate-500">{subtitle ?? 'Public Grievance Redressal — Pilot'}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {title && <span className="hidden text-sm font-semibold text-slate-600 sm:block">{title}</span>}
          {right}
        </div>
      </div>
    </header>
  );
}
