'use client';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CalendarDays,
  CircleDashed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { type Entry, outcomes, elapsed } from '@/lib/roll';
import {
  type Locale,
  translate,
  localizeError,
  formatDateRange,
  duration,
} from '@/lib/i18n';
import {
  DAYS_PER_YEAR,
  LIFE_KEY,
  rollScale,
  rollGrid,
  createLifeReference,
  parseLifeReference,
  lifeScale,
  type LifeReference,
} from '@/lib/time-scale';

type Props = {
  history: readonly Entry[];
  asOf: number;
  locale: Locale;
  formatLocale: string;
};
export function TimeScale({ history, asOf, locale, formatLocale }: Props) {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  const n = (value: number, digits = 0) =>
    new Intl.NumberFormat(formatLocale, {
      maximumFractionDigits: digits,
    }).format(value);
  const rollsText = (value: number) =>
    t(Math.round(value) === 1 ? '約1ロール' : '約{rolls}ロール', {
      rolls: n(value),
    });
  const groupText = (value: number) =>
    t(value === 1 ? '1マスは1ロール' : '1マスは最大{count}ロール', {
      count: n(value),
    });
  const scale = rollScale(history, asOf);
  const [lifeOpen, setLifeOpen] = useState(false);
  const [life, setLife] = useState<LifeReference | null>(null);
  const [age, setAge] = useState('');
  const [target, setTarget] = useState('90');
  const [customAge, setCustomAge] = useState('');
  const [lifeError, setLifeError] = useState('');
  const [group, setGroup] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  if (!scale) return null;
  const last = history.at(-1)!;
  const completedTime = elapsed(last.startedAt, Date.parse(last.endedAt));
  const date = new Date(asOf);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year + 1, 0, 1).getTime();
  const fraction = (asOf - startOfYear) / (endOfYear - startOfYear);
  const yearGrid = rollGrid(scale.yearlyRolls, 1, 180);
  const pastCells = Math.floor(yearGrid.cells.length * fraction);
  const lifeResult = life ? lifeScale(life, asOf, scale.averageDays) : null;
  const lifeGrid = lifeResult ? rollGrid(lifeResult.rolls, group) : null;
  const entry = selected === null ? null : history[selected];
  function toggleLife() {
    if (lifeOpen) {
      setLifeOpen(false);
      return;
    }
    setLifeOpen(true);
    setLifeError('');
    try {
      const raw = localStorage.getItem(LIFE_KEY);
      if (!raw) return;
      const saved = parseLifeReference(raw);
      setLife(saved);
      setAge('');
      if ([80, 90, 100].includes(saved.targetAge))
        setTarget(String(saved.targetAge));
      else {
        setTarget('custom');
        setCustomAge(String(saved.targetAge));
      }
    } catch {
      setLifeError('Life Viewの設定を読み込めませんでした。');
    }
  }
  function saveLife() {
    try {
      if (!age.trim() || (target === 'custom' && !customAge.trim()))
        throw new Error('年齢を入力してください。');
      const next = createLifeReference(
        Number(age),
        Number(target === 'custom' ? customAge : target),
        asOf,
      );
      try {
        localStorage.setItem(LIFE_KEY, JSON.stringify(next));
      } catch {
        throw new Error('Life Viewの設定を保存できませんでした。');
      }
      setLife(next);
      setLifeError('');
    } catch (error) {
      setLifeError(error instanceof Error ? error.message : '入力エラー');
    }
  }
  return (
    <section className="time-scale" aria-label={t('時間スケール')}>
      <div className="scale-intro">
        <CircleDashed />
        <p className="eyebrow">{t('時間スケールが開きました。')}</p>
        <h2>{t('このペースで、時間をロールに。')}</h2>
        <p>{t('今回を含む{count}本からの換算', { count: n(scale.count) })}</p>
      </div>
      <div className="scale-completed">
        <span>{t('このひと巻きの時間')}</span>
        <strong>
          {duration(formatLocale, completedTime.days, completedTime.hours)}
        </strong>
      </div>
      <div className="sample-status">
        <span>
          {t(scale.count === 1 ? '初期推定・1本の観測' : '観測にもとづく換算')}
        </span>
        <strong>
          {t('平均{days}日／ロール', { days: n(scale.averageDays, 2) })}
        </strong>
      </div>
      <div className="scale-horizons">
        {[1, 10, 30].map((years) => (
          <div key={years}>
            <span>{t('年数の目安', { years: n(years) })}</span>
            <strong>{rollsText(scale.yearlyRolls * years)}</strong>
          </div>
        ))}
      </div>
      <p className="scale-caveat">
        {t(
          'このペースが続くと仮定した換算です。予測の確かさを示すものではありません。',
        )}
      </p>
      {scale.count >= 3 && scale.recentAverageDays !== null && (
        <div className="recent-pace">
          <span>
            {t('直近30日間に終了した{count}本', {
              count: n(scale.recentCount),
            })}
          </span>
          <strong>
            {t('平均{days}日／ロール', { days: n(scale.recentAverageDays, 2) })}
          </strong>
        </div>
      )}
      <details className="calculation-note scale-formula">
        <summary>{t('観測と計算の根拠')}</summary>
        <dl className="methodology">
          <div>
            <dt>{t('観測した時間')}</dt>
            <dd>
              {t('{days}日・{count}本', {
                days: n(scale.observedDays, 3),
                count: n(scale.count),
              })}
            </dd>
          </div>
          <div>
            <dt>{t('平均間隔の式')}</dt>
            <dd>
              {n(scale.observedDays, 3)} ÷ {n(scale.count)} ={' '}
              {n(scale.averageDays, 3)}
            </dd>
          </div>
          <div>
            <dt>{t('年間換算の式')}</dt>
            <dd>
              {n(DAYS_PER_YEAR, 4)} ÷ {n(scale.averageDays, 3)} ≈{' '}
              {n(scale.yearlyRolls, 1)}
            </dd>
          </div>
        </dl>
        <p>{t('時間スケールの計算説明')}</p>
        <p>
          {t('同居人数やロールの長さが変わると、交換のペースも変わります。')}
        </p>
        {scale.averageDays < 1 && (
          <p>
            {t(
              '観測間隔が1日未満です。開始・交換日時が正しいか確認してください。',
            )}
          </p>
        )}
      </details>
      <section className="roll-year">
        <div className="section-heading">
          <h3>{t('{year}年をロールで見る', { year: String(year) })}</h3>
          <span>{rollsText(scale.yearlyRolls)}</span>
        </div>
        <figure
          aria-label={t('年のロール図', {
            year: String(year),
            count: n(yearGrid.total),
          })}
          className="roll-mosaic year-mosaic"
        >
          {yearGrid.cells.map((amount, i) => (
            <span
              key={i}
              className={i < pastCells ? 'model-past' : 'model-future'}
              aria-hidden="true"
              title={rollsText(amount)}
            />
          ))}
        </figure>
        <div className="mosaic-legend">
          <span>{groupText(yearGrid.group)}</span>
          <span>
            <i className="model-past" />
            {t('換算上の過去')}
            <i className="model-future" />
            {t('換算上のこれから')}
          </span>
        </div>
        <p className="field-note">
          {t(
            '今年の図は年の進行割合を当てはめたイメージです。実際の交換履歴ではありません。',
          )}
        </p>
      </section>
      <section className="life-section">
        <Button
          type="button"
          variant="outline"
          className="life-toggle"
          onClick={toggleLife}
          aria-expanded={lifeOpen}
          aria-controls="life-view"
        >
          <CalendarDays />
          {t(lifeOpen ? 'Life Viewを閉じる' : '自分で選ぶ時間軸を見る')}
          <ChevronDown />
        </Button>
        <p className="field-note">
          {t('Life Viewは任意です。年齢の目安を選んだときだけ表示します。')}
        </p>
        {lifeOpen && (
          <div id="life-view" className="life-view">
            <h3>{t('何歳までを、一つの目安にしますか？')}</h3>
            <p className="field-note">
              {t('寿命の予測ではなく、自分で選ぶ時間の目安です。')}
            </p>
            <label htmlFor="life-current-age">{t('現在の年齢')}</label>
            <div className="unit-input">
              <Input
                id="life-current-age"
                type="number"
                min={0}
                max={149}
                step={1}
                value={age}
                onChange={(event) => setAge(event.target.value)}
              />
              <span>{t('歳')}</span>
            </div>
            <p id="life-target-label" className="field-label">
              {t('基準にする年齢')}
            </p>
            <RadioGroup
              value={target}
              onValueChange={(value) => setTarget(String(value))}
              aria-labelledby="life-target-label"
              className="life-targets"
            >
              {['80', '90', '100', 'custom'].map((value) => (
                <label key={value} htmlFor={`life-${value}`}>
                  <RadioGroupItem id={`life-${value}`} value={value} />
                  <span>
                    {value === 'custom'
                      ? t('自分で設定')
                      : t('{age}歳', { age: value })}
                  </span>
                </label>
              ))}
            </RadioGroup>
            {target === 'custom' && (
              <>
                <label htmlFor="life-custom-age">{t('基準年齢を入力')}</label>
                <Input
                  id="life-custom-age"
                  type="number"
                  min={1}
                  max={150}
                  step={1}
                  value={customAge}
                  onChange={(event) => setCustomAge(event.target.value)}
                />
              </>
            )}
            <Button type="button" className="life-apply" onClick={saveLife}>
              {t('この目安で見る')}
              <ArrowRight />
            </Button>
            {lifeError && (
              <p role="alert" className="error-message">
                {localizeError(locale, lifeError)}
              </p>
            )}
            {life && lifeResult && lifeGrid && (
              <div className="life-result">
                <p>
                  {t('あなたが選んだ{age}歳という目安まで', {
                    age: n(life.targetAge),
                  })}
                </p>
                <strong>
                  {t(
                    Math.round(lifeResult.rolls) === 1
                      ? 'あと約1ロール'
                      : 'あと約{rolls}ロール',
                    { rolls: n(lifeResult.rolls) },
                  )}
                </strong>
                <span>
                  {t(
                    Math.round(lifeResult.remainingDays) === 1
                      ? '約1日'
                      : '約{days}日',
                    { days: n(lifeResult.remainingDays) },
                  )}
                </span>
                <p className="field-note">
                  {t('基準日は{date}、その時点で{age}歳として設定', {
                    date: new Intl.DateTimeFormat(formatLocale).format(
                      new Date(life.setAt),
                    ),
                    age: n(life.age),
                  })}
                </p>
                {lifeResult.remainingDays === 0 && (
                  <p>
                    {t(
                      '選んだ時間の目安に到達しました。必要なら、新しい目安を選べます。',
                    )}
                  </p>
                )}
                <label htmlFor="life-zoom">{t('表示の細かさ')}</label>
                <NativeSelect
                  id="life-zoom"
                  value={String(group)}
                  onChange={(event) => setGroup(Number(event.target.value))}
                >
                  {[1, 10, 100].map((value) => (
                    <NativeSelectOption key={value} value={String(value)}>
                      {groupText(value)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <figure
                  className="roll-mosaic life-mosaic"
                  aria-label={t('選んだ時間軸の図', {
                    rolls: n(lifeGrid.total),
                    group: n(lifeGrid.group),
                  })}
                >
                  {lifeGrid.cells.map((amount, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      title={rollsText(amount)}
                    />
                  ))}
                </figure>
                <p className="field-note">
                  {groupText(lifeGrid.group)} ·{' '}
                  {t('表示は最大600マスにまとめます。')}
                </p>
                <p className="field-note">
                  {t('Life Viewの計算説明', {
                    days: n(lifeResult.remainingDays, 1),
                    interval: n(scale.averageDays, 3),
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
      <details className="observed-rolls">
        <summary>{t('実際に記録した区切りを見る')}</summary>
        <div className="recorded-grid">
          {history.map((item, index) => (
            <Button
              type="button"
              variant="outline"
              key={item.endedAt}
              aria-label={t('ロール番号', { count: n(index + 1) })}
              aria-pressed={selected === index}
              onClick={() => setSelected(selected === index ? null : index)}
            >
              {n(index + 1)}
            </Button>
          ))}
        </div>
        {entry && (
          <article className="selected-record">
            <p className="eyebrow">
              {t('ロール番号', { count: n((selected ?? 0) + 1) })}
            </p>
            <p>
              {formatDateRange(formatLocale, entry.startedAt, entry.endedAt)}
            </p>
            <h3>{entry.goal}</h3>
            <span className={`outcome-badge ${entry.outcome}`}>
              {t(outcomes[entry.outcome])}
            </span>
            {entry.note && <p className="entry-note">{entry.note}</p>}
          </article>
        )}
        <p className="field-note">
          {t('今回の振り返りは、次の目標と一緒に最後に保存します。')}
        </p>
      </details>
    </section>
  );
}
