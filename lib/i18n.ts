import { messages } from './messages.ts';

export const languages = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'ko', label: '한국어' },
  { id: 'es', label: 'Español' },
] as const;
export type Locale = (typeof languages)[number]['id'];
export const LANGUAGE_KEY = 'hitomaki.language.v1';
export function isLocale(value: unknown): value is Locale {
  return languages.some(({ id }) => id === value);
}
export function detectLocale(
  saved: unknown,
  preferred: readonly string[],
): Locale {
  if (isLocale(saved)) return saved;
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    if (language === 'zh') return 'zh-Hans';
    if (isLocale(language)) return language;
  }
  return 'en';
}
export function regionalLocale(
  locale: Locale,
  preferred: readonly string[],
): string {
  const language = locale.split('-')[0];
  for (const tag of preferred) {
    try {
      const candidate = new Intl.Locale(tag);
      if (candidate.language === language) {
        return locale === 'zh-Hans'
          ? `zh-Hans-${candidate.region || 'CN'}`
          : candidate.baseName;
      }
    } catch {
      /* Ignore invalid browser preference entries. */
    }
  }
  return {
    ja: 'ja-JP',
    en: 'en-US',
    'zh-Hans': 'zh-Hans-CN',
    ko: 'ko-KR',
    es: 'es-ES',
  }[locale];
}
export function translate(
  locale: Locale,
  key: string,
  parameters: Record<string, string | number> = {},
) {
  const dictionary: Readonly<Record<string, string>> = messages[locale];
  const template = dictionary[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    String(parameters[name] ?? match),
  );
}
export function localizeError(locale: Locale, error: unknown): string {
  const key =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return translate(
    locale,
    Object.hasOwn(messages[locale], key)
      ? key
      : '操作を完了できませんでした。もう一度お試しください。',
  );
}
export function unitLabel(
  locale: string,
  value: number,
  unit: 'day' | 'hour' | 'minute',
) {
  return (
    new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' })
      .formatToParts(value)
      .find((part) => part.type === 'unit')?.value ?? unit
  );
}
export function duration(locale: string, days: number, hours: number) {
  const format = (value: number, unit: 'day' | 'hour') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(value);
  return `${format(days, 'day')} ${format(hours, 'hour')}`;
}
export function formatDateRange(locale: string, start: string, end: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).formatRange(new Date(start), new Date(end));
}
export function goalForSave(draft: string | null, locale: Locale): string {
  return draft ?? translate(locale, '本を20ページ読む');
}
