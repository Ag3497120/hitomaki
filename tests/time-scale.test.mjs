import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  initialState,
  startRoll,
  exchangeRoll,
  undoExchange,
} from '../lib/roll.ts';
import {
  DAYS_PER_YEAR,
  LIFE_KEY,
  rollScale,
  createLifeReference,
  parseLifeReference,
  lifeScale,
  rollGrid,
} from '../lib/time-scale.ts';
const at = Date.parse('2026-09-05T00:00:00Z');
const entry = (days, end = at) => ({
  startedAt: new Date(end - days * DAY_MS).toISOString(),
  endedAt: new Date(end).toISOString(),
  goal: '読書',
  dailyMinutes: 10,
  minutesPerPage: 2,
  outcome: 'done',
  note: '',
});
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('完了したロールがない間は時間スケールを開かない', () => {
  assert.equal(rollScale([], at), null);
  assert.equal(rollScale([entry(6, at + DAY_MS)], at), null);
});
test('初回6.4日から年間・10年・30年を丸める前の間隔で換算', () => {
  const scale = rollScale([entry(6.4)], at);
  assert.equal(scale.count, 1);
  close(scale.observedDays, 6.4);
  close(scale.averageDays, 6.4);
  close(scale.yearlyRolls, DAYS_PER_YEAR / 6.4);
  assert.equal(Math.round(scale.yearlyRolls), 57);
  assert.equal(Math.round(scale.yearlyRolls * 10), 571);
  assert.equal(Math.round(scale.yearlyRolls * 30), 1712);
});
test('年間本数の平均ではなく、実測日数の合計を本数で割る', () => {
  const scale = rollScale(
    [entry(4, at - 12 * DAY_MS), entry(8, at - 4 * DAY_MS), entry(4)],
    at,
  );
  close(scale.averageDays, 16 / 3);
  close(scale.yearlyRolls, DAYS_PER_YEAR / (16 / 3));
});
test('直近30日は終了時刻で選び、境界をまたぐロールも全期間を使う', () => {
  const scale = rollScale(
    [
      entry(6, at - 40 * DAY_MS),
      entry(6, at - 30 * DAY_MS),
      entry(10, at - 25 * DAY_MS),
      entry(5),
    ],
    at,
  );
  assert.equal(scale.count, 4);
  assert.equal(scale.recentCount, 2);
  close(scale.recentAverageDays, 7.5);
  const old = rollScale([entry(6, at - 40 * DAY_MS)], at);
  assert.equal(old.recentCount, 0);
  assert.equal(old.recentAverageDays, null);
});
test('振り返りのプレビューは保存済み状態を変えず、保存時にも交換時刻が動かない', () => {
  const started = startRoll(
    initialState(),
    {
      startedAt: new Date(at - 6 * DAY_MS).toISOString(),
      goal: '本を読む',
      dailyMinutes: 10,
      minutesPerPage: 2,
    },
    at,
  );
  const input = {
    endedAt: new Date(at).toISOString(),
    outcome: 'progress',
    note: '途中まで',
    nextGoal: '続きを読む',
  };
  const preview = exchangeRoll(started, input, at + 3_600_000);
  assert.equal(started.history.length, 0);
  close(rollScale(preview.history, at).averageDays, 6);
  const saved = exchangeRoll(started, input, at + 2 * 3_600_000);
  assert.equal(saved.history[0].endedAt, input.endedAt);
  assert.equal(rollScale(undoExchange(saved).history, at), null);
});
test('30歳→90歳は自分で選んだ60年。再表示しても基準日を更新しない', () => {
  const ref = createLifeReference(30, 90, at);
  const restored = parseLifeReference(JSON.stringify(ref));
  assert.equal(restored.targetAge, 90);
  close(lifeScale(restored, at, 6.4).remainingDays, 60 * DAYS_PER_YEAR);
  close(
    lifeScale(restored, at + 10 * DAY_MS, 6.4).remainingDays,
    60 * DAYS_PER_YEAR - 10,
  );
  assert.equal(restored.targetAt, ref.targetAt);
  close(lifeScale(restored, at, 6.4).rolls, (60 * DAYS_PER_YEAR) / 6.4);
  assert.notEqual(LIFE_KEY, 'hitomaki.v1');
});
test('不正な年齢・逆転した基準・破損した設定を拒否し、期限後は0に止める', () => {
  for (const [age, target] of [
    [30, 30],
    [90, 80],
    [-1, 90],
    [30, 151],
    [30.5, 90],
    [NaN, 90],
  ])
    assert.throws(() => createLifeReference(age, target, at));
  for (const raw of ['null', '{}', '{'])
    assert.throws(() => parseLifeReference(raw));
  const ref = createLifeReference(30, 31, at);
  assert.deepEqual(lifeScale(ref, Date.parse(ref.targetAt) + DAY_MS, 6), {
    remainingDays: 0,
    rolls: 0,
  });
  assert.throws(() =>
    parseLifeReference(
      JSON.stringify({ ...ref, targetAt: new Date(at).toISOString() }),
    ),
  );
  assert.throws(() => lifeScale(ref, at, 0));
});
test('可視化は丸めた本数を保持し、大量の本数を600マス以内にまとめる', () => {
  for (const rolls of [0, 0.2, 1, 57, 3420, 1e10]) {
    for (const zoom of [1, 10, 100]) {
      const grid = rollGrid(rolls, zoom);
      assert.ok(grid.cells.length <= 600);
      assert.equal(
        grid.cells.reduce((sum, n) => sum + n, 0),
        Math.round(rolls),
      );
      assert.ok(grid.cells.every((n) => n > 0 && n <= grid.group));
    }
  }
  assert.throws(() => rollGrid(Infinity));
  assert.throws(() => rollScale([entry(0)], at));
});
