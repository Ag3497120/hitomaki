import { DAY_MS, type Entry } from './roll.ts';

export const DAYS_PER_YEAR = 365.2425;
export const LIFE_KEY = 'hitomaki.life-view.v1';
export type LifeReference = {
  version: 1;
  age: number;
  targetAge: number;
  setAt: string;
  targetAt: string;
};
export function rollScale(history: readonly Entry[], asOf: number) {
  const completed = history.filter(
    (entry) => Date.parse(entry.endedAt) <= asOf,
  );
  if (!completed.length) return null;
  const lengths = completed.map(
    (entry) =>
      (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / DAY_MS,
  );
  if (lengths.some((days) => !Number.isFinite(days) || days <= 0))
    throw new Error('記録の日時を確認してください。');
  const observedDays = lengths.reduce((sum, days) => sum + days, 0);
  const averageDays = observedDays / completed.length;
  const recent = completed.filter(
    (entry) => Date.parse(entry.endedAt) > asOf - 30 * DAY_MS,
  );
  const recentDays = recent.reduce(
    (sum, entry) =>
      sum + (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / DAY_MS,
    0,
  );
  return {
    count: completed.length,
    observedDays,
    averageDays,
    yearlyRolls: DAYS_PER_YEAR / averageDays,
    recentCount: recent.length,
    recentAverageDays: recent.length ? recentDays / recent.length : null,
  };
}
export function createLifeReference(
  age: number,
  targetAge: number,
  now: number,
): LifeReference {
  if (
    !Number.isInteger(age) ||
    age < 0 ||
    age > 149 ||
    !Number.isInteger(targetAge) ||
    targetAge <= age ||
    targetAge > 150 ||
    !Number.isFinite(now)
  )
    throw new Error(
      '基準年齢は現在の年齢より大きい整数で、150歳以下にしてください。',
    );
  return {
    version: 1,
    age,
    targetAge,
    setAt: new Date(now).toISOString(),
    targetAt: new Date(
      now + (targetAge - age) * DAYS_PER_YEAR * DAY_MS,
    ).toISOString(),
  };
}
export function parseLifeReference(raw: string): LifeReference {
  const value = JSON.parse(raw) as LifeReference;
  if (
    !value ||
    value.version !== 1 ||
    typeof value.setAt !== 'string' ||
    typeof value.targetAt !== 'string'
  )
    throw new Error('Life Viewの設定を読み込めませんでした。');
  const expected = createLifeReference(
    value.age,
    value.targetAge,
    Date.parse(value.setAt),
  );
  if (value.targetAt !== expected.targetAt)
    throw new Error('Life Viewの設定を読み込めませんでした。');
  return value;
}
export function lifeScale(
  reference: LifeReference,
  asOf: number,
  averageDays: number,
) {
  if (!Number.isFinite(averageDays) || averageDays <= 0)
    throw new Error('記録の日時を確認してください。');
  const remainingDays = Math.max(
    0,
    (Date.parse(reference.targetAt) - asOf) / DAY_MS,
  );
  return { remainingDays, rolls: remainingDays / averageDays };
}
export function rollGrid(rolls: number, desiredGroup = 1, limit = 600) {
  if (
    !Number.isFinite(rolls) ||
    rolls < 0 ||
    !Number.isFinite(desiredGroup) ||
    desiredGroup < 1
  )
    throw new Error('記録の日時を確認してください。');
  const total = Math.round(rolls);
  const group = Math.max(Math.ceil(desiredGroup), Math.ceil(total / limit), 1);
  const cells = Array.from({ length: Math.ceil(total / group) }, (_, index) =>
    Math.min(group, total - index * group),
  );
  return { total, group, cells };
}
