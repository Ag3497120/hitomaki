export const STORAGE_KEY = 'hitomaki.v1';
export const DAY_MS = 86_400_000;
export type Outcome = 'done' | 'progress' | 'paused';
export type Preferences = { dailyMinutes: number; minutesPerPage: number };
export type Roll = Preferences & { startedAt: string; goal: string };
export type Entry = Roll & { endedAt: string; outcome: Outcome; note: string };
export type State = {
  version: 1;
  revision: number;
  preferences: Preferences;
  active: Roll | null;
  history: Entry[];
};
export const initialState = (): State => ({
  version: 1,
  revision: 0,
  preferences: { dailyMinutes: 10, minutesPerPage: 2 },
  active: null,
  history: [],
});
export const outcomes: Record<Outcome, string> = {
  done: 'できた',
  progress: '少し進んだ',
  paused: '今回は見送った',
};
function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function validTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function validatePreferences(value: Preferences) {
  invariant(
    Number.isInteger(value.dailyMinutes) &&
      value.dailyMinutes >= 1 &&
      value.dailyMinutes <= 1440,
    '1日の時間は1〜1,440分の整数で入力してください。',
  );
  invariant(
    Number.isFinite(value.minutesPerPage) &&
      value.minutesPerPage >= 0.1 &&
      value.minutesPerPage <= 60,
    '1ページの時間は0.1〜60分で入力してください。',
  );
}
export function validateGoal(goal: string) {
  invariant(
    typeof goal === 'string' &&
      goal.trim().length > 0 &&
      goal.trim().length <= 100,
    '目標を1〜100文字で入力してください。',
  );
  return goal.trim();
}
function validateRoll(roll: Roll) {
  invariant(roll && validTime(roll.startedAt), '開始日時を読み取れません。');
  validateGoal(roll.goal);
  validatePreferences(roll);
}
export function parseState(raw: string): State {
  const s = JSON.parse(raw) as State;
  invariant(
    s &&
      s.version === 1 &&
      Number.isInteger(s.revision) &&
      s.revision >= 0 &&
      s.preferences &&
      Array.isArray(s.history),
    '保存データの形式が異なります。',
  );
  validatePreferences(s.preferences);
  invariant(
    s.active === null || (s.active && typeof s.active === 'object'),
    '保存データの形式が異なります。',
  );
  if (s.active) validateRoll(s.active);
  let previousEnd = -Infinity;
  for (const h of s.history) {
    validateRoll(h);
    invariant(
      validTime(h.endedAt) && Date.parse(h.endedAt) > Date.parse(h.startedAt),
      '履歴の日時が正しくありません。',
    );
    invariant(
      Date.parse(h.startedAt) === previousEnd || previousEnd === -Infinity,
      '履歴の順序が正しくありません。',
    );
    invariant(
      Object.hasOwn(outcomes, h.outcome) &&
        typeof h.note === 'string' &&
        h.note.length <= 500,
      '振り返りを読み取れません。',
    );
    previousEnd = Date.parse(h.endedAt);
  }
  if (s.history.length)
    invariant(
      s.active && Date.parse(s.active.startedAt) === previousEnd,
      '現在のロールと履歴が一致しません。',
    );
  return s;
}
export function startRoll(
  s: State,
  input: { goal: string; startedAt: string } & Preferences,
  now: number,
): State {
  invariant(!s.active, 'すでにロールを記録しています。');
  validatePreferences(input);
  invariant(
    validTime(input.startedAt) && Date.parse(input.startedAt) <= now,
    '開始日時は現在以前にしてください。',
  );
  const preferences = {
    dailyMinutes: input.dailyMinutes,
    minutesPerPage: input.minutesPerPage,
  };
  return {
    ...s,
    revision: s.revision + 1,
    preferences,
    active: {
      ...preferences,
      goal: validateGoal(input.goal),
      startedAt: new Date(input.startedAt).toISOString(),
    },
  };
}
export function exchangeRoll(
  s: State,
  input: { endedAt: string; outcome: Outcome; note: string; nextGoal: string },
  now: number,
): State {
  invariant(s.active, '最初のロールを記録してください。');
  invariant(
    validTime(input.endedAt) &&
      Date.parse(input.endedAt) > Date.parse(s.active.startedAt) &&
      Date.parse(input.endedAt) <= now,
    '交換日時は開始より後、現在以前にしてください。',
  );
  invariant(
    Object.hasOwn(outcomes, input.outcome),
    '振り返りを選んでください。',
  );
  invariant(
    typeof input.note === 'string' && input.note.length <= 500,
    'ひとことは500文字以内で入力してください。',
  );
  const endedAt = new Date(input.endedAt).toISOString();
  return {
    ...s,
    revision: s.revision + 1,
    history: [
      ...s.history,
      { ...s.active, endedAt, outcome: input.outcome, note: input.note.trim() },
    ],
    active: {
      ...s.preferences,
      startedAt: endedAt,
      goal: validateGoal(input.nextGoal),
    },
  };
}
export function updateGoal(s: State, goal: string): State {
  invariant(s.active, '最初のロールを記録してください。');
  return {
    ...s,
    revision: s.revision + 1,
    active: { ...s.active, goal: validateGoal(goal) },
  };
}
export function updatePreferences(s: State, preferences: Preferences): State {
  validatePreferences(preferences);
  return {
    ...s,
    revision: s.revision + 1,
    preferences: { ...preferences },
    active: s.active ? { ...s.active, ...preferences } : null,
  };
}
export function undoExchange(s: State): State {
  const last = s.history.at(-1);
  invariant(last, '取り消せる交換がありません。');
  return {
    ...s,
    revision: s.revision + 1,
    history: s.history.slice(0, -1),
    active: { startedAt: last.startedAt, goal: last.goal, ...s.preferences },
  };
}
export function elapsed(startedAt: string, now: number) {
  const ms = Math.max(0, now - Date.parse(startedAt));
  return {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    totalDays: ms / DAY_MS,
  };
}
export function equivalent(roll: Roll, now: number) {
  const minutes = elapsed(roll.startedAt, now).totalDays * roll.dailyMinutes;
  return {
    minutes: Math.floor(minutes),
    pages: Math.floor(minutes / roll.minutesPerPage),
  };
}
export function yearProgress(now: Date) {
  const year = now.getFullYear();
  const start = Date.UTC(year, 0, 1),
    end = Date.UTC(year + 1, 0, 1);
  const today = Date.UTC(year, now.getMonth(), now.getDate());
  return {
    year,
    total: (end - start) / DAY_MS,
    passed: (today - start) / DAY_MS,
    remaining: (end - today) / DAY_MS,
  };
}
export function localDateTime(date: Date) {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
