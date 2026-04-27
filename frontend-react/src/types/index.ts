export type LanguageCode = 'en' | 'ne' | 'tam';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Record<LanguageCode, Language> = {
  en: { code: 'en', name: 'English', nativeName: 'English' },
  ne: { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  tam: { code: 'tam', name: 'Tamang', nativeName: 'तामाङ' }
};

export type TranslationState = 'idle' | 'uploading' | 'translating' | 'done' | 'error';

export interface TranslationStats {
  segmentCount: number;
  cacheHits: number;
  apiCalls: number;
  processingTimeMs: number;
}

export interface TranslationProgress {
  current: number;
  total: number;
}
