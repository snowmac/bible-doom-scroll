import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getState, setState, useStore, markRead, toggleSaved, isSavedIn } from '../lib/store.js';
import { useEngine } from '../engine.js';

const fontFor = (n) => (n < 70 ? 36 : n < 130 ? 30 : n < 210 ? 26 : n < 320 ? 22 : n < 460 ? 19 : 16);

const Card = memo(function Card({ book, chapter, name, v, total, attribution }) {
  const saved = useStore((s) => isSavedIn(s.saved, book, chapter, v.n));
  const [pop, setPop] = useState(0);
  const like = (dbl) => {
    const on = toggleSaved(book, chapter, v.n);
    if (dbl && on) { setPop((p) => p + 1); if (getState().haptics) navigator.vibrate?.([10, 30, 10]); }
  };
  return (
    <section className="card" data-book={book} data-chapter={chapter} data-verse={v.n} data-name={name} data-total={total}
      onDoubleClick={() => like(true)}>
      <div className="ref">{name} {chapter}:{v.n}</div>
      <p className="verse" style={{ fontSize: fontFor(v.text.length) }}>{v.text}</p>
      <button type="button" className={`like${saved ? ' on' : ''}`} aria-label={saved ? 'Unsave verse' : 'Save verse'}
        onClick={() => like(false)}><Icon name="heart" size={26} fill={saved} /></button>
      <div className="attr">{attribution}</div>
      {pop > 0 && <span key={pop} className="heartpop"><Icon name="heart" size={96} fill /></span>}
    </section>
  );
});

function Head({ book, chapter, name, count }) {
  return (
    <section className="card head" data-kind="head" data-book={book} data-chapter={chapter}>
      <div className="kicker">{name}</div>
      <h1>{book === 'psalms' ? 'Psalm' : 'Chapter'} {chapter}</h1>
      <div className="hint">{count} verses · swipe up</div>
    </section>
  );
}

export default function ScrollFeed() {
  const { provider, bg, audio, setRef } = useEngine();
  const books = useMemo(() => provider.books(), [provider]);
  const [chunks, setChunks] = useState([]);
  const [progress, setProgress] = useState(0);
  const streak = useStore((s) => s.streak);
  const read = useStore((s) => s.versesRead);

  const feedRef = useRef(null);
  const io = useRef(null);
  const active = useRef(null);
  const busy = useRef(false);
  const seen = useRef(new Set());
  const started = useRef(false);
  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;

  const load = useCallback(async (book, chapter) => ({
    key: `${book}.${chapter}`, book, chapter,
    name: books.find((b) => b.id === book).name,
    verses: await provider.chapter(book, chapter),
  }), [provider, books]);

  const nextOf = useCallback((book, chapter) => {
    const i = books.findIndex((b) => b.id === book);
    if (chapter < books[i].chapters) return [book, chapter + 1];
    return i + 1 < books.length ? [books[i + 1].id, 1] : null;
  }, [books]);

  // first chapter
  useEffect(() => {
    let dead = false;
    const s = getState();
    load(s.book, s.chapter).then((c) => { if (!dead) setChunks([c]); });
    return () => { dead = true; };
  }, [load]);

  // land on the saved verse once
  useLayoutEffect(() => {
    if (started.current || !chunks.length) return;
    started.current = true;
    const s = getState(), feed = feedRef.current;
    const el = feed.querySelector(`[data-book="${s.book}"][data-chapter="${s.chapter}"][data-verse="${s.verse}"]`) || feed.querySelector('.card');
    el?.scrollIntoView({ block: 'start' });
  }, [chunks]);

  const more = (card) => {
    if (busy.current) return;
    const cards = [...feedRef.current.children];
    if (cards.indexOf(card) < cards.length - 5) return;
    const last = chunksRef.current.at(-1);
    const nx = last && nextOf(last.book, last.chapter);
    if (!nx) return;
    busy.current = true;
    load(nx[0], nx[1]).then((c) => setChunks((cs) => [...cs, c])).finally(() => { busy.current = false; });
  };

  // activation logic lives in a ref so the observer never sees stale closures
  const activate = useRef(null);
  activate.current = (card) => {
    if (card === active.current) return;
    active.current = card;
    const d = card.dataset, st = getState();
    if (d.kind) { bg.shift(`${d.book}${d.chapter}`, 0); more(card); return; }
    const c = Number(d.chapter), v = Number(d.verse);
    setState({ book: d.book, chapter: c, verse: v });
    bg.shift(`${d.book}${c}`, v);
    setRef(`${d.name} ${c}:${v}`);
    const key = `${d.book}.${c}.${v}`;
    if (!seen.current.has(key)) { seen.current.add(key); markRead(); }
    if (st.tick) audio.tick();
    if (st.haptics) navigator.vibrate?.(6);
    setProgress(v / Number(d.total));
    more(card);
  };

  useEffect(() => {
    io.current = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting && e.intersectionRatio >= 0.6) activate.current(e.target);
    }, { root: feedRef.current, threshold: [0.6] });
    return () => io.current.disconnect();
  }, []);

  // observe cards as they appear
  useEffect(() => {
    feedRef.current.querySelectorAll('.card:not([data-o])').forEach((n) => { n.dataset.o = '1'; io.current.observe(n); });
  }, [chunks]);

  // desktop keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const dir = e.key === 'ArrowDown' || e.key === ' ' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const cards = [...feedRef.current.children], i = cards.indexOf(active.current);
      cards[Math.max(0, Math.min(cards.length - 1, i + dir))]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const last = chunks.at(-1);
  const atEnd = last && !nextOf(last.book, last.chapter);

  return (
    <div className="scroll">
      <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>
      <div className="hud"><span>{streak}d streak</span><span>{read} read</span></div>
      <div className="feed" ref={feedRef}>
        {chunks.map((c) => (
          <Chunk key={c.key} c={c} attribution={provider.attribution} />
        ))}
        {atEnd && (
          <section className="card head" data-kind="end" data-book="end" data-chapter="0">
            <div className="kicker">The end</div>
            <h1>Revelation complete</h1>
            <button type="button" className="primary" onClick={() => {
              setState({ book: books[0].id, chapter: 1, verse: 1 });
              location.reload();
            }}>Start again</button>
          </section>
        )}
      </div>
    </div>
  );
}

const Chunk = memo(function Chunk({ c, attribution }) {
  return (
    <>
      <Head book={c.book} chapter={c.chapter} name={c.name} count={c.verses.length} />
      {c.verses.map((v) => (
        <Card key={v.n} book={c.book} chapter={c.chapter} name={c.name} v={v} total={c.verses[c.verses.length - 1].n} attribution={attribution} />
      ))}
    </>
  );
});
