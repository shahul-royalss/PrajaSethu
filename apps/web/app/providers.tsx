'use client';

import { I18nProvider } from './lib/intl';

export function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
