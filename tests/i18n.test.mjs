import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { messages } from '../lib/messages.ts';
import {
  detectLocale,
  regionalLocale,
  translate,
  localizeError,
  duration,
  formatDateRange,
  unitLabel,
  goalForSave,
  languages,
  LANGUAGE_KEY,
} from '../lib/i18n.ts';
import {
  startRoll,
  exchangeRoll,
  initialState,
  STORAGE_KEY,
} from '../lib/roll.ts';

test('全5言語で同じキーと差し込み変数を持ち、空の翻訳がない', () => {
  const keys = Object.keys(messages.ja).sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
  const params = (text) =>
    [...text.matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      .sort((a, b) => String(a).localeCompare(String(b)));
  for (const { id } of languages) {
    assert.deepEqual(
      Object.keys(messages[id]).sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
      keys,
    );
    for (const key of keys) {
      assert.ok(messages[id][key].trim(), `${id}: ${key}`);
      assert.deepEqual(
        params(messages[id][key]),
        params(messages.ja[key]),
        `${id}: ${key}`,
      );
    }
  }
});
test('保存した選択を優先し、ブラウザの複数の言語設定に対応する', () => {
  assert.equal(detectLocale('es', ['ja-JP']), 'es');
  assert.equal(detectLocale(null, ['de-DE', 'en-GB']), 'en');
  assert.equal(detectLocale('invalid', ['ko-KR']), 'ko');
  assert.equal(detectLocale(null, ['zh-CN']), 'zh-Hans');
  assert.equal(detectLocale(null, []), 'en');
  assert.notEqual(LANGUAGE_KEY, STORAGE_KEY);
});
test('言語を国籍とみなさず、該当言語の地域設定を使う', () => {
  assert.equal(regionalLocale('en', ['ja-JP', 'en-GB']), 'en-GB');
  assert.equal(regionalLocale('es', ['es-MX']), 'es-MX');
  assert.equal(regionalLocale('en', ['ja-JP']), 'en-US');
  assert.equal(regionalLocale('zh-Hans', ['zh-TW']), 'zh-Hans-TW');
});
test('単数複数と地域の日付・数値の表記が切り替わる', () => {
  assert.equal(unitLabel('en-US', 1, 'day'), 'day');
  assert.equal(unitLabel('en-US', 2, 'day'), 'days');
  assert.equal(unitLabel('es-ES', 1, 'day'), 'día');
  assert.equal(unitLabel('es-ES', 2, 'day'), 'días');
  assert.match(duration('en-US', 1, 2), /1.*2/);
  assert.equal(new Intl.NumberFormat('es-ES').format(1.5), '1,5');
  for (const { id } of languages) {
    const date = formatDateRange(
      regionalLocale(id, []),
      '2025-12-31T12:00:00Z',
      '2026-01-02T12:00:00Z',
    );
    assert.match(date, /2025/);
    assert.match(date, /2026/);
  }
});
test('未編集の初期目標だけを翻訳し、書きかけ・保存済みの目標やメモは変えない', () => {
  assert.equal(goalForSave(null, 'en'), 'Read 20 pages');
  assert.equal(goalForSave('本を20ページ読む', 'en'), '本を20ページ読む');
  assert.equal(goalForSave('', 'en'), '');
  const state = startRoll(
    initialState(),
    {
      goal: '祖母に電話する',
      startedAt: '2026-09-01T00:00:00Z',
      dailyMinutes: 10,
      minutesPerPage: 2,
    },
    Date.parse('2026-09-05'),
  );
  const done = exchangeRoll(
    state,
    {
      endedAt: '2026-09-02T00:00:00Z',
      outcome: 'done',
      note: '話せてよかった',
      nextGoal: 'また電話する',
    },
    Date.parse('2026-09-05'),
  );
  const before = JSON.stringify(done);
  for (const { id } of languages) {
    translate(id, 'できた');
    goalForSave(done.active.goal, id);
  }
  assert.equal(JSON.stringify(done), before);
});
test('英語ブランドと差し込み文章、既知・未知のエラーを扱う', () => {
  assert.equal(translate('en', 'ひと巻き'), 'Between Rolls');
  assert.equal(
    translate('en', '暮らしの区切りを、時間の気づきに。'),
    'Life happens between rolls.',
  );
  assert.equal(
    translate('es', '1日{minutes}分なら', { minutes: 10 }),
    'Con 10 min al día',
  );
  assert.match(
    localizeError('en', new Error('目標を1〜100文字で入力してください。')),
    /goal/,
  );
  assert.equal(
    localizeError('ko', new Error('unrecognized engine error')),
    messages.ko['操作を完了できませんでした。もう一度お試しください。'],
  );
});
test('画面の固定文章とラベルが翻訳され、t()の文字列キーが全て存在する', () => {
  for (const sourcePath of [
    '../app/page.tsx',
    '../components/time-scale.tsx',
  ]) {
    const source = fs.readFileSync(
      new URL(sourcePath, import.meta.url),
      'utf8',
    );
    const file = ts.createSourceFile(
      'page.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (ts.isJsxText(node)) {
        const value = node.text.trim();
        assert.ok(
          !value ||
            ['01', 'HITOMAKI'].includes(value) ||
            /^[\s÷=≈·]+$/.test(value),
          `Untranslated JSX: ${value}`,
        );
      }
      if (
        ts.isJsxAttribute(node) &&
        ['placeholder', 'aria-label', 'title'].includes(node.name.getText(file))
      )
        assert.ok(
          !ts.isStringLiteral(node.initializer),
          `Untranslated attribute: ${node.getText(file)}`,
        );
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(file) === 't' &&
        ts.isStringLiteral(node.arguments[0])
      )
        assert.ok(
          Object.hasOwn(messages.ja, node.arguments[0].text),
          `Unknown message: ${node.arguments[0].text}`,
        );
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
});
