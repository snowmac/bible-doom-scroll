import { useSyncExternalStore } from 'react';

const KEY = 'scrollword.v1';

const defaults = {
  mode: 'scroll',
  book: 'john', chapter: 1, verse: 1,
  wpm: 300, chunk: 1, context: true, punct: true, hideControls: false,
  bgKind: 'aurora',
  music: 'off', volume: 0.5,
  haptics: true, tick: false,
  saved: [],                      // [{book, chapter, verse}]
  streak: 0, lastDay: '', versesRead: 0,
  vwpm: 170, vchunk: 3, vhl: true, vupper: true, vvoice: 'timer',
  vbook: 'john', vchapter: 1, vfrom: 1, vto: 5,
  source: 'web', apiKey: '', bibleId: '', ttsUrl: '', ttsVoice: '',
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

let state = { ...defaults, ...load() };
const subs = new Set();
let timer = 0;

function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode or quota */ } }, 300);
}

export const getState = () => state;

export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  persist();
  subs.forEach((f) => f());
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

// Always pass a selector that returns a primitive (or a stable reference).
export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ---- reading stats & saved verses ----

export function touchStreak() {
  const today = new Date().toLocaleDateString('en-CA');
  if (state.lastDay === today) return;
  const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  setState({ streak: state.lastDay === y ? state.streak + 1 : 1, lastDay: today });
}

export const markRead = () => { touchStreak(); setState({ versesRead: state.versesRead + 1 }); };

const same = (s, b, c, v) => s.book === b && s.chapter === c && s.verse === v;
export const isSavedIn = (saved, b, c, v) => saved.some((s) => same(s, b, c, v));

export function toggleSaved(b, c, v) {
  const had = isSavedIn(state.saved, b, c, v);
  setState({ saved: had ? state.saved.filter((s) => !same(s, b, c, v)) : [...state.saved, { book: b, chapter: c, verse: v }] });
  return !had;
}
