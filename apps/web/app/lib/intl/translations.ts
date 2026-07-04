import { en } from './en';

// Per-language overrides of the English source (en.ts). Any missing key falls back
// to English automatically (see I18nProvider). Populated by translations.gen.ts.
import { generated } from './translations.gen';

export type Dict = Partial<typeof en>;

export const translations: Record<string, Dict> = {
  en,
  ...generated,
};
