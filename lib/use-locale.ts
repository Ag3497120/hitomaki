'use client';
import { useEffect, useState } from 'react';
import {
  detectLocale,
  isLocale,
  LANGUAGE_KEY,
  regionalLocale,
  translate,
  type Locale,
} from './i18n';

export function useLocale() {
  const [locale, setLocale] = useState<Locale>('ja');
  const [formatLocale, setFormatLocale] = useState('ja-JP');
  const [languageError, setLanguageError] = useState(false);
  useEffect(() => {
    const restore = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(LANGUAGE_KEY);
      } catch {
        /* Locale selection still works for this visit. */
      }
      const next = detectLocale(saved, navigator.languages);
      setLocale(next);
      setFormatLocale(regionalLocale(next, navigator.languages));
    };
    restore();
    const listener = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY || event.key === null) restore();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, 'ページタイトル');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(locale, 'ページ説明'));
    // Native validation messages are cached until explicitly cleared.
    document
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      )
      .forEach((field) => field.setCustomValidity(''));
  }, [locale]);
  function chooseLocale(value: string) {
    if (!isLocale(value)) return;
    setLocale(value);
    setFormatLocale(regionalLocale(value, navigator.languages));
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
      setLanguageError(false);
    } catch {
      setLanguageError(true);
    }
  }
  return {
    locale,
    formatLocale,
    chooseLocale,
    languageError,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
  };
}
