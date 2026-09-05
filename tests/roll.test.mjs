import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  startRoll,
  exchangeRoll,
  updatePreferences,
  updateGoal,
  undoExchange,
  parseState,
  equivalent,
  elapsed,
  yearProgress,
  DAY_MS,
} from '../lib/roll.ts';
const beginning = '2026-08-29T03:00:00.000Z';
const now = Date.parse(beginning) + 7 * DAY_MS;
const started = () =>
  startRoll(
    initialState(),
    {
      startedAt: beginning,
      goal: '本を20ページ読む',
      dailyMinutes: 10,
      minutesPerPage: 2,
    },
    now,
  );
const exchanged = () =>
  exchangeRoll(
    started(),
    {
      endedAt: new Date(now).toISOString(),
      outcome: 'done',
      note: '読めた',
      nextGoal: '散歩する',
    },
    now,
  );

test('7日で70分、35ページ。1日未満は経過時間に比例し、未来は負にしない', () => {
  assert.deepEqual(equivalent(started().active, now), {
    minutes: 70,
    pages: 35,
  });
  assert.deepEqual(
    equivalent(started().active, Date.parse(beginning) + DAY_MS / 2),
    { minutes: 5, pages: 2 },
  );
  assert.equal(elapsed(beginning, Date.parse(beginning) - DAY_MS).totalDays, 0);
});
test('開始→交換→再読み込みで、振り返りと次の目標が保持される', () => {
  const state = parseState(JSON.stringify(exchanged()));
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].goal, '本を20ページ読む');
  assert.equal(state.history[0].outcome, 'done');
  assert.equal(state.active.goal, '散歩する');
  assert.equal(state.active.startedAt, state.history[0].endedAt);
});
test('過去の換算条件を保持して、現在のペースだけを更新する', () => {
  const state = updatePreferences(exchanged(), {
    dailyMinutes: 20,
    minutesPerPage: 1,
  });
  assert.equal(state.active.dailyMinutes, 20);
  assert.equal(state.history[0].dailyMinutes, 10);
  assert.deepEqual(equivalent(state.history[0], now), {
    minutes: 70,
    pages: 35,
  });
  assert.equal(parseState(JSON.stringify(state)).preferences.minutesPerPage, 1);
});
test('未来・同時刻・開始前の交換や、二重開始を拒否し、元の記録を維持する', () => {
  const state = started();
  for (const time of [
    Date.parse(beginning),
    Date.parse(beginning) - 1,
    now + 1,
  ]) {
    assert.throws(() =>
      exchangeRoll(
        state,
        {
          endedAt: new Date(time).toISOString(),
          outcome: 'done',
          note: '',
          nextGoal: '次へ',
        },
        now,
      ),
    );
  }
  assert.throws(() => startRoll(state, { ...state.active }, now));
  assert.equal(state.history.length, 0);
  const next = exchanged();
  assert.throws(() =>
    exchangeRoll(
      next,
      {
        endedAt: new Date(now).toISOString(),
        outcome: 'done',
        note: '',
        nextGoal: '二重送信',
      },
      now,
    ),
  );
});
test('空の目標、不正な数値、未選択の振り返りを保存しない', () => {
  assert.throws(() => updateGoal(started(), '   '));
  for (const dailyMinutes of [0, -1, NaN, Infinity, 1441, 1.5]) {
    assert.throws(() =>
      updatePreferences(started(), { dailyMinutes, minutesPerPage: 2 }),
    );
  }
  assert.throws(() =>
    updatePreferences(started(), { dailyMinutes: 10, minutesPerPage: 0 }),
  );
  assert.throws(() =>
    exchangeRoll(
      started(),
      {
        endedAt: new Date(now).toISOString(),
        outcome: '',
        note: '',
        nextGoal: '次へ',
      },
      now,
    ),
  );
});
test('誤った交換を取り消すと元の開始日時・目標に戻る', () => {
  const restored = undoExchange(exchanged());
  assert.equal(restored.history.length, 0);
  assert.deepEqual(restored.active, started().active);
  assert.throws(() => undoExchange(restored));
});
test('破損・非対応バージョン・不整合な履歴を検知する', () => {
  for (const raw of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...initialState(), version: 2 }),
  ])
    assert.throws(() => parseState(raw));
  const s = exchanged();
  s.history[0].endedAt = beginning;
  assert.throws(() => parseState(JSON.stringify(s)));
});
test('年初・年末・うるう年を正しく数え、今日を残り日数に含める', () => {
  assert.deepEqual(yearProgress(new Date(2026, 0, 1, 12)), {
    year: 2026,
    total: 365,
    passed: 0,
    remaining: 365,
  });
  assert.deepEqual(yearProgress(new Date(2026, 11, 31, 12)), {
    year: 2026,
    total: 365,
    passed: 364,
    remaining: 1,
  });
  assert.equal(yearProgress(new Date(2028, 1, 29, 12)).total, 366);
});
