'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CircleDashed,
  History,
  Settings2,
  ArrowRight,
  BookOpen,
  Clock3,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Sprout,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useRoll } from '@/lib/use-roll';
import { TimeScale } from '@/components/time-scale';
import { useLocale } from '@/lib/use-locale';
import {
  languages,
  duration,
  unitLabel,
  formatDateRange,
  goalForSave,
  localizeError,
} from '@/lib/i18n';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  elapsed,
  equivalent,
  exchangeRoll,
  localDateTime,
  outcomes,
  startRoll,
  undoExchange,
  updateGoal,
  updatePreferences,
  type Outcome,
  type Preferences,
  type State,
} from '@/lib/roll';

type Modal = 'exchange' | 'scale' | 'goal' | 'undo' | null;

export default function Home() {
  const { state, ready, error, commit } = useRoll();
  const { locale, formatLocale, chooseLocale, languageError, t } = useLocale();
  const number = (value: number) =>
    new Intl.NumberFormat(formatLocale).format(value);
  const fullDate = (value: string) =>
    new Intl.DateTimeFormat(formatLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  const goals = [
    '本を20ページ読む',
    '散歩に1回出かける',
    '大切な人に連絡する',
  ].map((key) => t(key));
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState('current');
  const [modal, setModal] = useState<Modal>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [goal, setGoal] = useState<string | null>(null);
  const [daily, setDaily] = useState('10');
  const [pace, setPace] = useState('2');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [recordedAt, setRecordedAt] = useState(0);
  const [scaleSnapshot, setScaleSnapshot] = useState<{
    history: State['history'];
    endedAt: string;
    revision: number;
    asOf: number;
  } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [note, setNote] = useState('');
  const [nextGoal, setNextGoal] = useState('');
  const busy = useRef(false);
  const dialogPanel = useRef<HTMLDivElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);
  const active = state.active;
  useEffect(() => {
    if (modal !== 'scale') return;
    const frame = requestAnimationFrame(() => {
      dialogPanel.current?.scrollTo({ top: 0 });
      dialogHeading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [modal]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
    };
  }, []);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Resynchronize editable defaults with externally hydrated local storage.
    setDaily(String(state.preferences.dailyMinutes));
    setPace(String(state.preferences.minutesPerPage));
  }, [state.preferences.dailyMinutes, state.preferences.minutesPerPage]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'hitomaki.v1' || event.key === null) {
        setModal(null);
        setActionError('');
        setNotice('別の画面の変更を反映しました。');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const run = (change: (s: State) => State, success: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      commit(change);
      setModal(null);
      setActionError('');
      setNotice(success);
      setNow(new Date());
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : '操作を完了できませんでした。もう一度お試しください。',
      );
    } finally {
      busy.current = false;
    }
  };
  const open = (kind: Modal) => {
    setActionError('');
    setNotice('');
    setGoal(active?.goal || goals[0]);
    setNextGoal(active?.goal || goals[0]);
    setEnd('');
    setRecordedAt(Date.now());
    setScaleSnapshot(null);
    setOutcome('');
    setNote('');
    setModal(kind);
  };
  const live = useRef({ state, commit, open });
  useEffect(() => {
    live.current = { state, commit, open };
  });
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!ready || !context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'get_roll_summary',
        description:
          'Read the active roll, its goal, and the number of completed rolls.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => {
          const s = live.current.state;
          return { active: s.active, completedRolls: s.history.length };
        },
      },
      {
        name: 'update_current_roll_goal',
        description:
          'Update the active roll goal and save it in this browser. Does not record a roll change.',
        inputSchema: {
          type: 'object',
          properties: {
            goal: { type: 'string', minLength: 1, maxLength: 100 },
          },
          required: ['goal'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          if (
            !input ||
            typeof input !== 'object' ||
            !('goal' in input) ||
            typeof input.goal !== 'string' ||
            Object.keys(input).length !== 1
          )
            throw new Error('goalだけを文字列で指定してください。');
          const goal = input.goal;
          const next = live.current.commit((s) => updateGoal(s, goal));
          setNotice('目標を更新しました。');
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          return { goal: next.active?.goal };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => console.warn('WebMCP registration unavailable'));
      } catch {
        console.warn('WebMCP registration unavailable');
      }
    }
    return () => lifecycle.abort();
  }, [ready]);
  const time = active && now ? elapsed(active.startedAt, now.getTime()) : null;
  const eq = active && now ? equivalent(active, now.getTime()) : null;
  const totalMinutes = state.history.reduce(
    (sum, h) => sum + equivalent(h, Date.parse(h.endedAt)).minutes,
    0,
  );
  const previewEnd = end ? Date.parse(end) : recordedAt;
  const reviewTime =
    active && previewEnd && Number.isFinite(previewEnd)
      ? elapsed(active.startedAt, previewEnd)
      : null;
  const reviewEq =
    active && previewEnd && Number.isFinite(previewEnd)
      ? equivalent(active, previewEnd)
      : null;
  const prefs = (): Preferences => ({
    dailyMinutes: Number(daily),
    minutesPerPage: Number(pace),
  });

  return (
    <div
      className="app-shell"
      lang={locale}
      onInvalid={(event) => {
        const field = event.target;
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        )
          field.setCustomValidity(
            t(field.validity.valueMissing ? '入力必須' : '入力エラー'),
          );
      }}
      onInput={(event) => {
        const field = event.target;
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        )
          field.setCustomValidity('');
      }}
    >
      <header className="site-header">
        <Link className="brand" href="/" aria-label={t('ひと巻き ホーム')}>
          <CircleDashed aria-hidden="true" />
          <span>
            {t('ひと巻き')}
            <small>HITOMAKI</small>
          </span>
        </Link>
        <span className="header-note">
          {t('暮らしの区切りを、時間の気づきに。')}
        </span>
        <div className="header-actions">
          <NativeSelect
            className="language-select"
            value={locale}
            onChange={(event) => chooseLocale(event.target.value)}
            aria-label={t('言語')}
          >
            {languages.map((language) => (
              <NativeSelectOption
                key={language.id}
                value={language.id}
                lang={language.id}
              >
                {language.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="local-badge">
            <i />
            {error ? t('保存の確認が必要です') : t('この端末に保存')}
          </span>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{t('A LITTLE TIME, A LITTLE CHANGE')}</p>
            <h1>{t('次のひと巻きを、どう過ごそう。')}</h1>
          </div>
          <span className="edition">
            {now
              ? now.toLocaleDateString(formatLocale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })
              : t('YOUR EVERYDAY')}
          </span>
        </div>
        {languageError && (
          <p role="alert" className="error-message">
            {t('言語保存エラー')}
          </p>
        )}
        {error && (
          <p role="alert" className="error-message">
            {localizeError(locale, error)}
          </p>
        )}
        {notice && (
          <output className="success-message">
            <Check size={18} />
            <span>{t(notice)}</span>
            <Button
              variant="ghost"
              aria-label={t('メッセージを閉じる')}
              onClick={() => setNotice('')}
            >
              <X />
            </Button>
          </output>
        )}
        {actionError && !modal && (
          <p role="alert" className="error-message">
            {localizeError(locale, actionError)}
          </p>
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(String(v));
            setActionError('');
          }}
        >
          <TabsList
            variant="line"
            className="app-tabs"
            aria-label={t('ひと巻きの画面')}
          >
            <TabsTrigger value="current">
              <CircleDashed />
              {t('いまのひと巻き')}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              {t('これまで')}
              {state.history.length > 0 && (
                <span className="count-badge">
                  {number(state.history.length)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 />
              {t('設定')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            {!active ? (
              <section className="start-layout">
                <article className="intro-card">
                  <p className="eyebrow">
                    {t('ひと巻きが、時間のしるしになる。')}
                  </p>
                  <div className="first-number">
                    01<span>{t('ROLL')}</span>
                  </div>
                  <h2>{t('最初のひと巻きから。')}</h2>
                  <p>
                    {t(
                      '交換するたび、少し立ち止まる。これからの時間に、小さな楽しみをひとつ。',
                    )}
                  </p>
                  <div className="intro-bottom">
                    <ArrowUpRight />
                    <span>{t('使い終わったら、ここで振り返りましょう。')}</span>
                  </div>
                </article>
                <article className="setup-card">
                  <p className="eyebrow">{t('LET’S BEGIN')}</p>
                  <h2>{t('次の交換までに、したいこと。')}</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        (s) =>
                          startRoll(
                            s,
                            {
                              ...prefs(),
                              goal: goalForSave(goal, locale),
                              startedAt: start
                                ? new Date(start).toISOString()
                                : new Date().toISOString(),
                            },
                            Date.now(),
                          ),
                        '最初のひと巻きが始まりました。次の交換で、またここへ。',
                      );
                    }}
                  >
                    <label htmlFor="first-goal">{t('小さな目標')}</label>
                    <Input
                      id="first-goal"
                      value={goalForSave(goal, locale)}
                      onChange={(e) => setGoal(e.target.value)}
                      maxLength={100}
                      required
                    />
                    <div className="suggestions">
                      {goals.slice(1).map((g) => (
                        <Button
                          key={g}
                          variant="outline"
                          onClick={() => setGoal(g)}
                          type="button"
                        >
                          <Plus />
                          {g}
                        </Button>
                      ))}
                    </div>
                    <label htmlFor="first-minutes">
                      {t('1日、自分のために使いたい時間')}
                    </label>
                    <div className="unit-input">
                      <Input
                        id="first-minutes"
                        type="number"
                        value={daily}
                        onChange={(e) => setDaily(e.target.value)}
                        min={1}
                        max={1440}
                        step={1}
                        required
                      />
                      <span>{t('分')}</span>
                    </div>
                    <details className="start-date">
                      <summary>{t('すでに使い始めている場合')}</summary>
                      <label htmlFor="start-date">{t('使い始めた日時')}</label>
                      <Input
                        id="start-date"
                        type="datetime-local"
                        value={start}
                        max={now ? localDateTime(now) : undefined}
                        onChange={(e) => setStart(e.target.value)}
                      />
                      <p className="field-note">
                        {t('空欄なら、今から記録します。')}
                      </p>
                    </details>
                    <Button
                      type="submit"
                      className="primary-action"
                      disabled={!ready || !!error}
                    >
                      {t('このロールを使い始める')}
                      <ArrowRight />
                    </Button>
                  </form>
                </article>
              </section>
            ) : (
              <>
                <section className="current-layout">
                  <article className="elapsed-card">
                    <div className="card-top">
                      <span className="eyebrow">{t('YOUR CURRENT ROLL')}</span>
                      <span className="on-going">
                        <i />
                        {t('使用中・{count}本目', {
                          count: number(state.history.length + 1),
                        })}
                      </span>
                    </div>
                    <h2>{t('このひと巻きと、過ごした時間。')}</h2>
                    <div className="time-counter">
                      <span className="large-number">
                        {number(time?.days ?? 0)}
                      </span>
                      <span className="time-unit">
                        {unitLabel(formatLocale, time?.days ?? 0, 'day')}
                      </span>
                      <span className="hour-number">
                        {number(time?.hours ?? 0)}
                      </span>
                      <span className="time-unit">
                        {unitLabel(formatLocale, time?.hours ?? 0, 'hour')}
                      </span>
                    </div>
                    <p className="started-date">
                      {t('{date}から', { date: fullDate(active.startedAt) })}
                    </p>
                    <div className="elapsed-footer">
                      <span>{t('新しいロールに替えたら、ひと区切り。')}</span>
                      <Button
                        className="exchange-button"
                        onClick={() => open('exchange')}
                        disabled={!ready || !!error}
                      >
                        {t('交換を記録する')}
                        <ArrowRight />
                      </Button>
                    </div>
                  </article>
                  <article className="goal-card">
                    <div className="card-top">
                      <span className="eyebrow">
                        {t('ONE SMALL INTENTION')}
                      </span>
                      <Sprout size={22} />
                    </div>
                    <p className="section-label">
                      {t('次の交換までの、小さな目標')}
                    </p>
                    <h2 className="goal-text">{active.goal}</h2>
                    <p className="muted">
                      {t('少し進むだけでも、大切な一歩。')}
                    </p>
                    <Button
                      variant="ghost"
                      className="edit-goal"
                      onClick={() => open('goal')}
                    >
                      <Pencil />
                      {t('目標を見直す')}
                    </Button>
                  </article>
                </section>
                <section className="possibility-section">
                  <div className="section-heading">
                    <h2>{t('小さな時間も、積み重なる。')}</h2>
                    <span>
                      {t('1日{minutes}分なら', {
                        minutes: number(active.dailyMinutes),
                      })}
                    </span>
                  </div>
                  <div className="equivalent-grid">
                    <article className="equivalent-card">
                      <div className="metric-icon">
                        <Clock3 />
                      </div>
                      <div>
                        <p>{t('自分のための時間にすると')}</p>
                        <strong>
                          {number(eq?.minutes ?? 0)}
                          <span>{t('分')}</span>
                        </strong>
                        <small>{t('このロールを使い始めてからの換算')}</small>
                      </div>
                    </article>
                    <article className="equivalent-card">
                      <div className="metric-icon">
                        <BookOpen />
                      </div>
                      <div>
                        <p>{t('その時間で、読書をするなら')}</p>
                        <strong>
                          {number(eq?.pages ?? 0)}
                          <span>
                            {t(eq?.pages === 1 ? 'ページ単数' : 'ページ')}
                          </span>
                        </strong>
                        <small>
                          {t('1ページ{minutes}分として', {
                            minutes: number(active.minutesPerPage),
                          })}
                        </small>
                      </div>
                    </article>
                  </div>
                  <details className="calculation-note">
                    <summary>{t('この数字の考え方')}</summary>
                    <dl className="methodology">
                      <div>
                        <dt>{t('記録した開始日時')}</dt>
                        <dd>{fullDate(active.startedAt)}</dd>
                      </div>
                      <div>
                        <dt>{t('換算時点')}</dt>
                        <dd>{now ? fullDate(now.toISOString()) : '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('経過時間')}</dt>
                        <dd>
                          {new Intl.NumberFormat(formatLocale, {
                            style: 'unit',
                            unit: 'day',
                            unitDisplay: 'long',
                            maximumFractionDigits: 2,
                          }).format(time?.totalDays ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('仮定')}</dt>
                        <dd>
                          {t('1日{minutes}分なら', {
                            minutes: number(active.dailyMinutes),
                          })}
                          <br />
                          {t('1ページ{minutes}分として', {
                            minutes: number(active.minutesPerPage),
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('読書の換算結果')}</dt>
                        <dd>
                          {number(eq?.pages ?? 0)}{' '}
                          {t(eq?.pages === 1 ? 'ページ単数' : 'ページ')}
                        </dd>
                      </div>
                    </dl>
                    <p>
                      {t('計算の説明', {
                        daily: number(active.dailyMinutes),
                        pace: number(active.minutesPerPage),
                      })}
                    </p>
                  </details>
                </section>
              </>
            )}
            {state.history.length === 0 && (
              <aside className="scale-locked">
                <CircleDashed />
                <div>
                  <h2>{t('時間スケールは、最初の1本のあとに。')}</h2>
                  <p>
                    {t(
                      'まずは、ひと巻き分の暮らしを観測しましょう。交換すると、あなたのペースで時間をロールに換算できます。',
                    )}
                  </p>
                </div>
              </aside>
            )}
          </TabsContent>
          <TabsContent value="history">
            <div className="section-heading history-heading">
              <div>
                <p className="eyebrow">{t('LITTLE MOMENTS, COLLECTED')}</p>
                <h2>{t('ひと巻きずつ、積み重ねたこと。')}</h2>
              </div>
            </div>
            {state.history.length === 0 ? (
              <Empty className="history-empty">
                <EmptyHeader>
                  <History size={32} />
                  <EmptyTitle className="empty-title">
                    {t('最初の区切りは、これから。')}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t(
                      'ロールを交換すると、目標と振り返りがここに残ります。できたことも、見送ったことも、自分の歩みです。',
                    )}
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" onClick={() => setTab('current')}>
                  {t('いまのひと巻きへ')}
                  <ArrowRight />
                </Button>
              </Empty>
            ) : (
              <>
                <div className="history-stats">
                  <div>
                    <span>{t('交換したロール')}</span>
                    <strong>{number(state.history.length)}</strong>
                  </div>
                  <div>
                    <span>{t('達成した目標')}</span>
                    <strong>
                      {number(
                        state.history.filter((h) => h.outcome === 'done')
                          .length,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{t('各期間の時間換算の合計')}</span>
                    <strong>
                      {number(totalMinutes)}
                      <small>{t('分')}</small>
                    </strong>
                  </div>
                </div>
                <div className="history-list">
                  {[...state.history].reverse().map((h, i) => {
                    const historyTime = elapsed(
                      h.startedAt,
                      Date.parse(h.endedAt),
                    );
                    return (
                      <article className="history-entry" key={h.endedAt}>
                        <div className="entry-index">
                          {String(state.history.length - i).padStart(2, '0')}
                        </div>
                        <div className="entry-body">
                          <div className="entry-meta">
                            <time dateTime={h.endedAt}>
                              {formatDateRange(
                                formatLocale,
                                h.startedAt,
                                h.endedAt,
                              )}
                            </time>
                            <span>
                              {duration(
                                formatLocale,
                                historyTime.days,
                                historyTime.hours,
                              )}
                            </span>
                          </div>
                          <h3>{h.goal}</h3>
                          {h.note && <p className="entry-note">{h.note}</p>}
                          <span className={`outcome-badge ${h.outcome}`}>
                            {h.outcome === 'done' ? (
                              <Check size={14} />
                            ) : (
                              <Sprout size={14} />
                            )}{' '}
                            {t(outcomes[h.outcome])}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  className="undo-button"
                  onClick={() => open('undo')}
                >
                  <RotateCcw />
                  {t('直前の交換を取り消す')}
                </Button>
              </>
            )}
          </TabsContent>
          <TabsContent value="settings">
            <section className="settings-layout">
              <article className="setup-card">
                <label htmlFor="settings-language">{t('言語')}</label>
                <NativeSelect
                  id="settings-language"
                  value={locale}
                  onChange={(event) => chooseLocale(event.target.value)}
                >
                  {languages.map((language) => (
                    <NativeSelectOption
                      key={language.id}
                      value={language.id}
                      lang={language.id}
                    >
                      {language.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="field-note language-help">{t('言語の説明')}</p>
                <p className="eyebrow">{t('YOUR OWN PACE')}</p>
                <h2>{t('あなたのペースで。')}</h2>
                <p className="muted">
                  {t('いまの生活に合う時間を決めましょう。')}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      (s) => updatePreferences(s, prefs()),
                      '換算の条件を保存しました。',
                    );
                  }}
                >
                  <label htmlFor="setting-daily">
                    {t('1日、自分のために使いたい時間')}
                  </label>
                  <div className="unit-input">
                    <Input
                      id="setting-daily"
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      required
                      value={daily}
                      onChange={(e) => setDaily(e.target.value)}
                    />
                    <span>{t('分 / 日')}</span>
                  </div>
                  <label htmlFor="setting-pace">
                    {t('本を1ページ読む時間')}
                  </label>
                  <div className="unit-input">
                    <Input
                      id="setting-pace"
                      type="number"
                      min={0.1}
                      max={60}
                      step={0.1}
                      required
                      value={pace}
                      onChange={(e) => setPace(e.target.value)}
                    />
                    <span>{t('分 / ページ')}</span>
                  </div>
                  <p className="field-note">
                    {t(
                      '初期値の2分は例です。自分の読書ペースに合わせて変更できます。',
                    )}
                  </p>
                  <Button
                    className="primary-action"
                    type="submit"
                    disabled={!ready || !!error}
                  >
                    {t('このペースを保存する')}
                    <Check />
                  </Button>
                  <p className="field-note">
                    {t(
                      '現在と次のロールに適用します。過去の換算条件は変わりません。',
                    )}
                  </p>
                </form>
              </article>
              <aside className="settings-about">
                <CircleDashed size={32} />
                <h2>{t('区切りがあると、時間が少し見えてくる。')}</h2>
                <p>
                  {t(
                    'トイレットペーパーを交換する日。いつもの暮らしの中にある、その小さな区切りを、自分のための振り返りに。',
                  )}
                </p>
                <h3>{t('記録について')}</h3>
                <p>
                  {t(
                    '記録はこのブラウザだけに保存されます。別の端末とは同期されず、ブラウザのデータを消すと記録も消えます。',
                  )}
                </p>
                <h3>{t('一緒に暮らす人がいる場合')}</h3>
                <p>
                  {t(
                    'ロールは家族や同居人と共有していても大丈夫。交換の間に流れた時間を使って、あなた自身の目標を振り返れます。',
                  )}
                </p>
              </aside>
            </section>
          </TabsContent>
        </Tabs>
        <footer>
          <span>{t('ひと巻きずつ、自分のペースで。')}</span>
          <span>{t('時間を責めず、これからを考える。')}</span>
        </footer>
      </main>
      <Dialog
        open={modal === 'exchange' || modal === 'scale' || modal === 'goal'}
        onOpenChange={(value) => {
          if (!value) {
            setModal(null);
            setActionError('');
          }
        }}
      >
        <DialogContent
          ref={dialogPanel}
          className={`roll-dialog ${modal === 'scale' ? 'scale-dialog' : ''}`}
          showCloseButton={false}
        >
          <DialogClose
            render={
              <Button
                variant="ghost"
                className="dialog-close"
                aria-label={t('閉じる')}
              />
            }
          >
            <X />
          </DialogClose>
          <DialogTitle
            className="dialog-title"
            ref={dialogHeading}
            tabIndex={-1}
          >
            {modal === 'scale'
              ? t('ひと巻きから、もっと先の時間へ。')
              : modal === 'exchange'
                ? t('ひと巻き、おつかれさま。')
                : modal === 'goal'
                  ? t('目標を、いまの自分に合わせる。')
                  : t('直前の交換を取り消しますか？')}
          </DialogTitle>
          <DialogDescription>
            {modal === 'scale'
              ? t('少し先を眺めたら、次の小さな目標へ。')
              : modal === 'exchange'
                ? t('過ごした時間を振り返って、次の小さな一歩へ。')
                : modal === 'goal'
                  ? t('小さくしても、変えても大丈夫です。')
                  : t(
                      '直前の振り返りと、現在の目標を取り消し、前のロールを使用中に戻します。',
                    )}
          </DialogDescription>
          {modal === 'exchange' && active && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const endedAt = end
                    ? new Date(end).toISOString()
                    : new Date(recordedAt).toISOString();
                  const candidate = exchangeRoll(
                    state,
                    {
                      endedAt,
                      outcome: outcome as Outcome,
                      note,
                      nextGoal: active.goal,
                    },
                    Date.now(),
                  );
                  setScaleSnapshot({
                    history: candidate.history,
                    endedAt,
                    revision: state.revision,
                    asOf: Date.now(),
                  });
                  setActionError('');
                  setModal('scale');
                } catch (error) {
                  setActionError(
                    error instanceof Error ? error.message : '入力エラー',
                  );
                }
              }}
            >
              <div className="review-summary">
                <span>{t('このひと巻きの時間')}</span>
                <strong>
                  {duration(
                    formatLocale,
                    reviewTime?.days ?? 0,
                    reviewTime?.hours ?? 0,
                  )}
                </strong>
                <p>
                  {t('振り返りの換算', {
                    daily: number(active.dailyMinutes),
                    minutes: number(reviewEq?.minutes ?? 0),
                  })}
                </p>
              </div>
              <details className="start-date">
                <summary>{t('交換日時を変更する')}</summary>
                <label htmlFor="exchange-date">{t('交換した日時')}</label>
                <Input
                  id="exchange-date"
                  type="datetime-local"
                  value={end}
                  max={now ? localDateTime(now) : undefined}
                  onChange={(e) => setEnd(e.target.value)}
                />
                <p className="field-note">
                  {t('空欄なら、交換ボタンを押した時刻で記録します。')}
                </p>
              </details>
              <p className="review-goal">
                {t('今回の目標：')}
                <strong>{active.goal}</strong>
              </p>
              <RadioGroup
                value={outcome}
                onValueChange={(v) => setOutcome(v as Outcome)}
                aria-label={t('今回の振り返り')}
                className="outcome-options"
              >
                {(Object.entries(outcomes) as [Outcome, string][]).map(
                  ([key, label]) => (
                    <label
                      key={key}
                      className={outcome === key ? 'selected' : ''}
                      htmlFor={`outcome-${key}`}
                    >
                      <RadioGroupItem id={`outcome-${key}`} value={key} />
                      <span>{t(label)}</span>
                    </label>
                  ),
                )}
              </RadioGroup>
              <label htmlFor="review-note">
                {t('ひとこと')}
                <span className="optional">{t('任意')}</span>
              </label>
              <Textarea
                id="review-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder={t('できたこと、気づいたこと。')}
              />
              {actionError && (
                <p role="alert" className="error-message">
                  {localizeError(locale, actionError)}
                </p>
              )}
              <Button
                type="submit"
                className="primary-action"
                disabled={!outcome || !!error}
              >
                {t('振り返って、時間スケールへ')}
                <ArrowRight />
              </Button>
            </form>
          )}
          {modal === 'scale' && scaleSnapshot && (
            <div className="scale-stage">
              <TimeScale
                history={scaleSnapshot.history}
                asOf={scaleSnapshot.asOf}
                locale={locale}
                formatLocale={formatLocale}
              />
              <form
                className="next-roll-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run((previous) => {
                    if (previous.revision !== scaleSnapshot.revision)
                      throw new Error(
                        '別の画面で記録が変わりました。最新の内容を確認して、もう一度操作してください。',
                      );
                    return exchangeRoll(
                      previous,
                      {
                        endedAt: scaleSnapshot.endedAt,
                        outcome: outcome as Outcome,
                        note,
                        nextGoal,
                      },
                      Date.now(),
                    );
                  }, '振り返りを保存しました。新しいひと巻きが始まります。');
                }}
              >
                <p className="eyebrow">{t('次のひと巻きに戻ろう。')}</p>
                <label htmlFor="next-goal">{t('次のひと巻きまでの目標')}</label>
                <Input
                  id="next-goal"
                  required
                  maxLength={100}
                  value={nextGoal}
                  onChange={(e) => setNextGoal(e.target.value)}
                />

                {actionError && (
                  <p role="alert" className="error-message">
                    {localizeError(locale, actionError)}
                  </p>
                )}
                <Button
                  type="submit"
                  className="primary-action"
                  disabled={!!error}
                >
                  {t('振り返りを保存して、次へ')}
                  <ArrowRight />
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="cancel-button"
                onClick={() => {
                  setActionError('');
                  setModal('exchange');
                }}
              >
                {t('振り返りに戻る')}
              </Button>
            </div>
          )}
          {modal === 'goal' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  (s) => updateGoal(s, goalForSave(goal, locale)),
                  '目標を更新しました。',
                );
              }}
            >
              <label htmlFor="edit-goal">{t('次の交換までの目標')}</label>
              <Input
                id="edit-goal"
                required
                maxLength={100}
                value={goalForSave(goal, locale)}
                onChange={(e) => setGoal(e.target.value)}
              />
              {actionError && (
                <p role="alert" className="error-message">
                  {localizeError(locale, actionError)}
                </p>
              )}
              <Button type="submit" className="primary-action">
                {t('目標を保存する')}
                <Check />
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={modal === 'undo'}
        onOpenChange={(value) => {
          if (!value) {
            setModal(null);
            setActionError('');
          }
        }}
      >
        <AlertDialogContent className="undo-dialog">
          <AlertDialogTitle>
            {t('直前の交換を取り消しますか？')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              '直前の振り返りと、現在の目標を取り消し、前のロールを使用中に戻します。',
            )}
          </AlertDialogDescription>
          {actionError && (
            <p role="alert" className="error-message">
              {localizeError(locale, actionError)}
            </p>
          )}
          <Button
            className="primary-action"
            onClick={() =>
              run(
                undoExchange,
                '直前の交換を取り消し、前のロールに戻しました。',
              )
            }
          >
            {t('前のロールに戻す')}
            <RotateCcw />
          </Button>
          <AlertDialogCancel className="cancel-button">
            {t('取り消さずに戻る')}
          </AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
