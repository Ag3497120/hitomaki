'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialState, parseState, STORAGE_KEY, type State } from './roll';

export function useRoll() {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(state);
  const stored = useRef<string | null>(null);
  const blocked = useRef(false);
  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const next = raw ? parseState(raw) : initialState();
      current.current = next;
      stored.current = raw;
      blocked.current = false;
      setState(next);
      setError('');
    } catch {
      blocked.current = true;
      setError(
        '保存した記録を読み込めませんでした。データを上書きせず保持しています。ブラウザの保存設定を確認して再読み込みしてください。',
      );
    }
  }, []);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser-only external storage after SSR.
    read();
    setReady(true);
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) read();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [read]);
  const commit = useCallback(
    (change: (previous: State) => State) => {
      if (blocked.current)
        throw new Error('記録を読み込めるようになるまで保存できません。');
      if (localStorage.getItem(STORAGE_KEY) !== stored.current) {
        read();
        throw new Error(
          '別の画面で記録が変わりました。最新の内容を確認して、もう一度操作してください。',
        );
      }
      const next = change(current.current);
      const raw = JSON.stringify(next);
      try {
        localStorage.setItem(STORAGE_KEY, raw);
      } catch {
        throw new Error(
          '保存できませんでした。ブラウザの空き容量と保存設定を確認してください。変更はまだ反映していません。',
        );
      }
      stored.current = raw;
      current.current = next;
      setState(next);
      setError('');
      return next;
    },
    [read],
  );
  return { state, ready, error, commit };
}
