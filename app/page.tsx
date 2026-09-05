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
  yearProgress,
  type Outcome,
  type Preferences,
  type State,
} from '@/lib/roll';

const number = (n: number) => n.toLocaleString('ja-JP');
const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
const fullDate = (s: string) =>
  new Date(s).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : '操作を完了できませんでした。もう一度お試しください。';
const goals = ['本を20ページ読む', '散歩に1回出かける', '大切な人に連絡する'];
type Modal = 'exchange' | 'goal' | 'undo' | null;

export default function Home() {
  const { state, ready, error, commit } = useRoll();
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState('current');
  const [modal, setModal] = useState<Modal>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [goal, setGoal] = useState(goals[0]);
  const [daily, setDaily] = useState('10');
  const [pace, setPace] = useState('2');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [note, setNote] = useState('');
  const [nextGoal, setNextGoal] = useState('');
  const busy = useRef(false);
  const active = state.active;
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
      setActionError(message(e));
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
        description: '現在のロールと目標、交換済みの本数を読み取ります。',
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
          '使用中のロールの目標を変更し、この端末に保存します。交換記録は作りません。',
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
  const year = now ? yearProgress(now) : null;
  const totalMinutes = state.history.reduce(
    (sum, h) => sum + equivalent(h, Date.parse(h.endedAt)).minutes,
    0,
  );
  const previewEnd = end ? Date.parse(end) : now?.getTime();
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
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="ひと巻き ホーム">
          <CircleDashed aria-hidden="true" />
          <span>
            ひと巻き<small>HITOMAKI</small>
          </span>
        </Link>
        <span className="header-note">暮らしの区切りを、時間の気づきに。</span>
        <span className="local-badge">
          <i />
          {error ? '保存の確認が必要です' : 'この端末に保存'}
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE TIME, A LITTLE CHANGE</p>
            <h1>
              次のひと巻きを、
              <br className="mobile-only" />
              どう過ごそう。
            </h1>
          </div>
          <span className="edition">
            {now
              ? now.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })
              : 'YOUR EVERYDAY'}
          </span>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {notice && (
          <output className="success-message">
            <Check size={18} />
            <span>{notice}</span>
            <Button
              variant="ghost"
              aria-label="メッセージを閉じる"
              onClick={() => setNotice('')}
            >
              <X />
            </Button>
          </output>
        )}
        {actionError && !modal && (
          <p role="alert" className="error-message">
            {actionError}
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
            aria-label="ひと巻きの画面"
          >
            <TabsTrigger value="current">
              <CircleDashed />
              いまのひと巻き
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              これまで
              {state.history.length > 0 && (
                <span className="count-badge">{state.history.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 />
              設定
            </TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            {!active ? (
              <section className="start-layout">
                <article className="intro-card">
                  <p className="eyebrow">ひと巻きが、時間のしるしになる。</p>
                  <div className="first-number">
                    01<span>ROLL</span>
                  </div>
                  <h2>最初のひと巻きから。</h2>
                  <p>
                    交換するたび、少し立ち止まる。
                    <br />
                    これからの時間に、小さな楽しみをひとつ。
                  </p>
                  <div className="intro-bottom">
                    <ArrowUpRight />
                    <span>使い終わったら、ここで振り返りましょう。</span>
                  </div>
                </article>
                <article className="setup-card">
                  <p className="eyebrow">LET’S BEGIN</p>
                  <h2>次の交換までに、したいこと。</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        (s) =>
                          startRoll(
                            s,
                            {
                              ...prefs(),
                              goal,
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
                    <label htmlFor="first-goal">小さな目標</label>
                    <Input
                      id="first-goal"
                      value={goal}
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
                      1日、自分のために使いたい時間
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
                      <span>分</span>
                    </div>
                    <details className="start-date">
                      <summary>すでに使い始めている場合</summary>
                      <label htmlFor="start-date">使い始めた日時</label>
                      <Input
                        id="start-date"
                        type="datetime-local"
                        value={start}
                        max={now ? localDateTime(now) : undefined}
                        onChange={(e) => setStart(e.target.value)}
                      />
                      <p className="field-note">空欄なら、今から記録します。</p>
                    </details>
                    <Button
                      type="submit"
                      className="primary-action"
                      disabled={!ready || !!error}
                    >
                      このロールを使い始める
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
                      <span className="eyebrow">YOUR CURRENT ROLL</span>
                      <span className="on-going">
                        <i />
                        使用中 · {state.history.length + 1}本目
                      </span>
                    </div>
                    <h2>このひと巻きと、過ごした時間。</h2>
                    <div className="time-counter">
                      <span className="large-number">{time?.days ?? 0}</span>
                      <span className="time-unit">日</span>
                      <span className="hour-number">{time?.hours ?? 0}</span>
                      <span className="time-unit">時間</span>
                    </div>
                    <p className="started-date">
                      {fullDate(active.startedAt)} から{' '}
                      <span>· {time?.minutes ?? 0}分</span>
                    </p>
                    <div className="elapsed-footer">
                      <span>新しいロールに替えたら、ひと区切り。</span>
                      <Button
                        className="exchange-button"
                        onClick={() => open('exchange')}
                        disabled={!ready || !!error}
                      >
                        交換を記録する
                        <ArrowRight />
                      </Button>
                    </div>
                  </article>
                  <article className="goal-card">
                    <div className="card-top">
                      <span className="eyebrow">ONE SMALL INTENTION</span>
                      <Sprout size={22} />
                    </div>
                    <p className="section-label">次の交換までの、小さな目標</p>
                    <h2 className="goal-text">{active.goal}</h2>
                    <p className="muted">少し進むだけでも、大切な一歩。</p>
                    <Button
                      variant="ghost"
                      className="edit-goal"
                      onClick={() => open('goal')}
                    >
                      <Pencil />
                      目標を見直す
                    </Button>
                  </article>
                </section>
                <section className="possibility-section">
                  <div className="section-heading">
                    <h2>小さな時間も、積み重なる。</h2>
                    <span>1日 {active.dailyMinutes} 分なら</span>
                  </div>
                  <div className="equivalent-grid">
                    <article className="equivalent-card">
                      <div className="metric-icon">
                        <Clock3 />
                      </div>
                      <div>
                        <p>自分のための時間にすると</p>
                        <strong>
                          {number(eq?.minutes ?? 0)}
                          <span>分</span>
                        </strong>
                        <small>このロールを使い始めてからの換算</small>
                      </div>
                    </article>
                    <article className="equivalent-card">
                      <div className="metric-icon">
                        <BookOpen />
                      </div>
                      <div>
                        <p>その時間で、読書をするなら</p>
                        <strong>
                          {number(eq?.pages ?? 0)}
                          <span>ページ</span>
                        </strong>
                        <small>1ページ {active.minutesPerPage} 分として</small>
                      </div>
                    </article>
                  </div>
                  <details className="calculation-note">
                    <summary>この数字の考え方</summary>
                    <p>
                      経過時間 ÷ 24時間 × 1日に使いたい{active.dailyMinutes}
                      分で計算し、読書はさらに1ページ{active.minutesPerPage}
                      分で割っています。表示は小数点以下を切り捨てます。実際に読んだ量や、浪費した時間を表すものではありません。条件は設定から変更できます。
                    </p>
                  </details>
                </section>
              </>
            )}
            {year && (
              <section className="year-card">
                <div className="year-heading">
                  <div>
                    <span className="eyebrow">THE DAYS AHEAD</span>
                    <h2>{year.year}年、これからの時間。</h2>
                  </div>
                  <p>
                    あと <strong>{year.remaining}</strong> 日
                    <small>今日を含む</small>
                  </p>
                </div>
                <figure
                  className="year-dots"
                  aria-label={`${year.year}年は全${year.total}日。${year.passed}日が過ぎ、今日を含めてあと${year.remaining}日です。`}
                >
                  {Array.from({ length: year.total }, (_, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={
                        i < year.passed
                          ? 'past'
                          : i === year.passed
                            ? 'today'
                            : 'future'
                      }
                    />
                  ))}
                </figure>
                <div className="year-legend">
                  <span>1マス = 1日</span>
                  <span>
                    <i className="legend-past" />
                    過ぎた日
                    <i className="legend-today" />
                    今日
                    <i className="legend-future" />
                    これから
                  </span>
                </div>
              </section>
            )}
          </TabsContent>
          <TabsContent value="history">
            <div className="section-heading history-heading">
              <div>
                <p className="eyebrow">LITTLE MOMENTS, COLLECTED</p>
                <h2>ひと巻きずつ、積み重ねたこと。</h2>
              </div>
            </div>
            {state.history.length === 0 ? (
              <Empty className="history-empty">
                <EmptyHeader>
                  <History size={32} />
                  <EmptyTitle className="empty-title">
                    最初の区切りは、これから。
                  </EmptyTitle>
                  <EmptyDescription>
                    ロールを交換すると、目標と振り返りがここに残ります。
                    <br />
                    できたことも、見送ったことも、自分の歩みです。
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" onClick={() => setTab('current')}>
                  いまのひと巻きへ
                  <ArrowRight />
                </Button>
              </Empty>
            ) : (
              <>
                <div className="history-stats">
                  <div>
                    <span>交換したロール</span>
                    <strong>
                      {state.history.length}
                      <small>本</small>
                    </strong>
                  </div>
                  <div>
                    <span>達成した目標</span>
                    <strong>
                      {state.history.filter((h) => h.outcome === 'done').length}
                      <small>個</small>
                    </strong>
                  </div>
                  <div>
                    <span>各期間の時間換算の合計</span>
                    <strong>
                      {number(totalMinutes)}
                      <small>分</small>
                    </strong>
                  </div>
                </div>
                <div className="history-list">
                  {[...state.history].reverse().map((h, i) => {
                    const t = elapsed(h.startedAt, Date.parse(h.endedAt));
                    return (
                      <article className="history-entry" key={h.endedAt}>
                        <div className="entry-index">
                          {String(state.history.length - i).padStart(2, '0')}
                        </div>
                        <div className="entry-body">
                          <div className="entry-meta">
                            <time dateTime={h.endedAt}>
                              {new Date(h.endedAt).getFullYear()}年{' '}
                              {dateLabel(h.startedAt)} — {dateLabel(h.endedAt)}
                            </time>
                            <span>
                              {t.days}日 {t.hours}時間
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
                            {outcomes[h.outcome]}
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
                  直前の交換を取り消す
                </Button>
              </>
            )}
          </TabsContent>
          <TabsContent value="settings">
            <section className="settings-layout">
              <article className="setup-card">
                <p className="eyebrow">YOUR OWN PACE</p>
                <h2>あなたのペースで。</h2>
                <p className="muted">いまの生活に合う時間を決めましょう。</p>
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
                    1日、自分のために使いたい時間
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
                    <span>分 / 日</span>
                  </div>
                  <label htmlFor="setting-pace">本を1ページ読む時間</label>
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
                    <span>分 / ページ</span>
                  </div>
                  <p className="field-note">
                    初期値の2分は例です。自分の読書ペースに合わせて変更できます。
                  </p>
                  <Button
                    className="primary-action"
                    type="submit"
                    disabled={!ready || !!error}
                  >
                    このペースを保存する
                    <Check />
                  </Button>
                  <p className="field-note">
                    現在と次のロールに適用します。過去の換算条件は変わりません。
                  </p>
                </form>
              </article>
              <aside className="settings-about">
                <CircleDashed size={32} />
                <h2>
                  区切りがあると、
                  <br />
                  時間が少し見えてくる。
                </h2>
                <p>
                  トイレットペーパーを交換する日。いつもの暮らしの中にある、その小さな区切りを、自分のための振り返りに。
                </p>
                <h3>記録について</h3>
                <p>
                  記録はこのブラウザだけに保存されます。別の端末とは同期されず、ブラウザのデータを消すと記録も消えます。
                </p>
                <h3>一緒に暮らす人がいる場合</h3>
                <p>
                  ロールは家族や同居人と共有していても大丈夫。交換の間に流れた時間を使って、あなた自身の目標を振り返れます。
                </p>
              </aside>
            </section>
          </TabsContent>
        </Tabs>
        <footer>
          <span>ひと巻きずつ、自分のペースで。</span>
          <span>時間を責めず、これからを考える。</span>
        </footer>
      </main>
      <Dialog
        open={modal === 'exchange' || modal === 'goal'}
        onOpenChange={(value) => {
          if (!value) {
            setModal(null);
            setActionError('');
          }
        }}
      >
        <DialogContent className="roll-dialog" showCloseButton={false}>
          <DialogClose
            render={
              <Button
                variant="ghost"
                className="dialog-close"
                aria-label="閉じる"
              />
            }
          >
            <X />
          </DialogClose>
          <DialogTitle className="dialog-title">
            {modal === 'exchange'
              ? 'ひと巻き、おつかれさま。'
              : modal === 'goal'
                ? '目標を、いまの自分に合わせる。'
                : '直前の交換を取り消しますか？'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'exchange'
              ? '過ごした時間を振り返って、次の小さな一歩へ。'
              : modal === 'goal'
                ? '小さくしても、変えても大丈夫です。'
                : '直前の振り返りと、現在の目標を取り消し、前のロールを使用中に戻します。'}
          </DialogDescription>
          {modal === 'exchange' && active && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  (s) =>
                    exchangeRoll(
                      s,
                      {
                        endedAt: end
                          ? new Date(end).toISOString()
                          : new Date().toISOString(),
                        outcome: outcome as Outcome,
                        note,
                        nextGoal,
                      },
                      Date.now(),
                    ),
                  '振り返りを保存しました。新しいひと巻きが始まります。',
                );
              }}
            >
              <div className="review-summary">
                <span>このひと巻きの時間</span>
                <strong>
                  {reviewTime?.days ?? 0}日 {reviewTime?.hours ?? 0}時間
                </strong>
                <p>
                  1日{active.dailyMinutes}分なら、約
                  {number(reviewEq?.minutes ?? 0)}分の積み重ね。
                </p>
              </div>
              <details className="start-date">
                <summary>交換日時を変更する</summary>
                <label htmlFor="exchange-date">交換した日時</label>
                <Input
                  id="exchange-date"
                  type="datetime-local"
                  value={end}
                  max={now ? localDateTime(now) : undefined}
                  onChange={(e) => setEnd(e.target.value)}
                />
                <p className="field-note">
                  空欄なら、保存した時刻で記録します。
                </p>
              </details>
              <p className="review-goal">
                今回の目標：<strong>{active.goal}</strong>
              </p>
              <RadioGroup
                value={outcome}
                onValueChange={(v) => setOutcome(v as Outcome)}
                aria-label="今回の振り返り"
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
                      <span>{label}</span>
                    </label>
                  ),
                )}
              </RadioGroup>
              <label htmlFor="review-note">
                ひとこと <span className="optional">任意</span>
              </label>
              <Textarea
                id="review-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="できたこと、気づいたこと。"
              />
              <label htmlFor="next-goal">次のひと巻きまでの目標</label>
              <Input
                id="next-goal"
                required
                maxLength={100}
                value={nextGoal}
                onChange={(e) => setNextGoal(e.target.value)}
              />
              {actionError && (
                <p role="alert" className="error-message">
                  {actionError}
                </p>
              )}
              <Button
                type="submit"
                className="primary-action"
                disabled={!outcome || !!error}
              >
                振り返りを保存して、次へ
                <ArrowRight />
              </Button>
            </form>
          )}
          {modal === 'goal' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run((s) => updateGoal(s, goal), '目標を更新しました。');
              }}
            >
              <label htmlFor="edit-goal">次の交換までの目標</label>
              <Input
                id="edit-goal"
                required
                maxLength={100}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
              {actionError && (
                <p role="alert" className="error-message">
                  {actionError}
                </p>
              )}
              <Button type="submit" className="primary-action">
                目標を保存する
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
          <AlertDialogTitle>直前の交換を取り消しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            直前の振り返りと、現在の目標を取り消し、前のロールを使用中に戻します。
          </AlertDialogDescription>
          {actionError && (
            <p role="alert" className="error-message">
              {actionError}
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
            前のロールに戻す
            <RotateCcw />
          </Button>
          <AlertDialogCancel className="cancel-button">
            取り消さずに戻る
          </AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
