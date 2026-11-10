import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getState, setState, useStore } from '../lib/store.js';
import { tokenize, buildSchedule, refLabel } from '../lib/timeline.js';
import { TimerNarrator, FileNarrator, SpeechNarrator } from '../lib/narrators.js';
import { drawCaption } from '../lib/caption.js';
import { recorderSupported, startRecording } from '../lib/recorder.js';
import { useEngine } from '../engine.js';
import { synthesize, audioElementFor, MAX_TTS_CHARS } from '../lib/tts.js';

const PREVIEW = [540, 960];
const EXPORT = [1080, 1920];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default function VideoStudio() {
  const { provider, bg, audio, toast, applyMusic, setRef } = useEngine();
  const books = useMemo(() => provider.books(), [provider]);
  const book = useStore((s) => s.vbook);
  const chapter = useStore((s) => s.vchapter);
  const from = useStore((s) => s.vfrom);
  const to = useStore((s) => s.vto);
  const wpm = useStore((s) => s.vwpm);
  const n = useStore((s) => s.vchunk);
  const hl = useStore((s) => s.vhl);
  const upper = useStore((s) => s.vupper);
  const voice = useStore((s) => s.vvoice);
  const punct = useStore((s) => s.punct);
  const ttsUrl = useStore((s) => s.ttsUrl);
  const ttsVoice = useStore((s) => s.ttsVoice);

  const [words, setWords] = useState([]);
  const [passage, setPassage] = useState('');
  const [maxVerse, setMaxVerse] = useState(1);
  const [mode, setMode] = useState('idle');           // idle | preview | record
  const [out, setOut] = useState(null);
  const [narr, setNarr] = useState(null);             // { name, secs }
  const [busyMsg, setBusyMsg] = useState('');

  const canvasRef = useRef(null);
  const wordsRef = useRef(words);
  const narratorRef = useRef(null);
  const recRef = useRef(null);
  const narrationEl = useRef(null);
  const fileInput = useRef(null);
  const outRef = useRef(null);
  const anim = useRef({ lastChunk: -1, chunkSince: 0 });
  const stopRef = useRef(() => {});
  wordsRef.current = words;

  const info = books.find((b) => b.id === book) || books[0];

  // load the selected passage
  useEffect(() => {
    let dead = false;
    (async () => {
      const all = await provider.chapter(book, chapter);
      if (dead) return;
      const max = all.length ? all[all.length - 1].n : 1;
      setMaxVerse(max);
      const f = clamp(from, 1, max), t = clamp(to, f, max);
      if (f !== from || t !== to) { setState({ vfrom: f, vto: t }); return; }
      const name = books.find((b) => b.id === book)?.name || book;
      const verses = all.filter((v) => v.n >= f && v.n <= t).map((v) => ({ ...v, ref: `${name} ${chapter}:${v.n}` }));
      setWords(tokenize(verses));
      setPassage(refLabel(name, chapter, f, t));
      bg.shift(`${book}${chapter}`, f);
    })();
    return () => { dead = true; };
  }, [provider, books, book, chapter, from, to, bg]);

  useEffect(() => { if (passage) setRef(passage); }, [passage, setRef]);
  useEffect(() => {
    if (out) { toast('Video ready'); outRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [out, toast]);

  const stop = useCallback(async () => {
    const nar = narratorRef.current, rec = recRef.current;
    if (!nar && !rec) return;
    nar?.stop();
    narratorRef.current = null; recRef.current = null;
    setMode('idle');
    if (rec) {
      const res = await rec.stop();
      setOut({ ...res, name: `${passage.replace(/[^\w]+/g, '-').toLowerCase()}.${res.ext}`, mb: (res.blob.size / 1e6).toFixed(1) });
    }
    const cv = canvasRef.current;
    if (cv) { cv.width = PREVIEW[0]; cv.height = PREVIEW[1]; }
    anim.current.lastChunk = -1;
  }, [passage]);
  stopRef.current = stop;

  // render loop: one canvas for preview and export
  useEffect(() => {
    const cv = canvasRef.current, c = cv.getContext('2d');
    let raf = 0;
    const loop = (now) => {
      const W = cv.width, H = cv.height;
      bg.draw(c, W, H, now);
      const ws = wordsRef.current;
      if (ws.length) {
        const nar = narratorRef.current;
        const i = nar ? clamp(nar.index, 0, ws.length - 1) : 0;
        cv.dataset.word = String(i); cv.dataset.t = nar?.el ? String(nar.el.currentTime) : '';
        const st = getState();
        drawCaption(c, W, H, now, {
          words: ws, i, n: st.vchunk, upper: st.vupper, highlight: st.vhl,
          progress: nar ? nar.progress : 0,
          label: provider.id === 'web' ? 'WEB' : provider.label,
          attribution: provider.attribution,
        }, anim.current);
        if (nar?.done) stopRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); narratorRef.current?.stop(); };
  }, [bg, provider]);

  const play = async (record) => {
    if (mode !== 'idle') { stop(); return; }
    if (!words.length) { toast('No text in that range'); return; }
    if (record && !recorderSupported()) { toast('This browser cannot record video'); return; }
    if (record && voice === 'speech') { toast("Browser voice can't be recorded. Use a narration file or silent captions."); return; }
    if (voice === 'file' && !narrationEl.current) { toast('Pick a narration file first'); fileInput.current?.click(); return; }
    if (voice === 'tts' && !ttsUrl) { toast('Add your voice endpoint in Settings first'); return; }

    audio.ensure();               // unlock audio inside the tap, before any network wait
    let nar, vox;
    if (voice === 'tts') {
      const text = words.map((w) => w.w).join(' ');
      if (text.length > MAX_TTS_CHARS) { toast(`Too long for one voice request (${text.length} of ${MAX_TTS_CHARS} characters). Shorten the range.`); return; }
      setBusyMsg('Generating voice…');
      try {
        const res = await synthesize(ttsUrl, text, ttsVoice);
        const el = await audioElementFor(res.url);
        vox = { el, timings: res.words };
      } catch (e) { setBusyMsg(''); toast(e.message || 'Voice failed'); return; }
      setBusyMsg('');
    }
    await applyMusic();
    if (voice === 'file') { audio.connectElement(narrationEl.current); nar = new FileNarrator(words, narrationEl.current, punct, wpm); }
    else if (voice === 'tts') { audio.connectElement(vox.el); nar = new FileNarrator(words, vox.el, punct, wpm, vox.timings); }
    else if (voice === 'speech') nar = new SpeechNarrator(words, wpm, punct);
    else nar = new TimerNarrator(words, wpm, punct);

    const cv = canvasRef.current, [W, H] = record ? EXPORT : PREVIEW;
    cv.width = W; cv.height = H;
    anim.current.lastChunk = -1;
    setOut(null);
    if (record) recRef.current = startRecording(cv, audio.dest.stream);
    narratorRef.current = nar;
    nar.start();
    setMode(record ? 'record' : 'preview');
  };

  const loadNarration = async (file) => {
    if (!file) return;
    const el = new Audio(URL.createObjectURL(file));
    el.preload = 'auto';
    await new Promise((res) => { el.onloadedmetadata = res; el.onerror = res; });
    if (!isFinite(el.duration)) { toast('Could not read that audio file'); return; }
    narrationEl.current = el;
    setNarr({ name: file.name, secs: el.duration });
  };

  const secs = Math.round(buildSchedule(words, wpm, punct).total / 1000);
  const busy = mode !== 'idle' || !!busyMsg;

  return (
    <div className="studio">
      <div className="s-preview">
        <canvas ref={canvasRef} width={PREVIEW[0]} height={PREVIEW[1]} />
        {busyMsg && <div className="s-status">{busyMsg}</div>}
        {!busy && words.length > 0 && <div className="s-status">{passage} · {words.length} words · ~{voice === 'file' && narr ? Math.round(narr.secs) : secs}s</div>}
      </div>

      <div className="s-panel form">
        <label>Passage
          <div className="two">
            <select value={book} onChange={(e) => setState({ vbook: e.target.value, vchapter: 1, vfrom: 1, vto: 5 })} disabled={busy}>
              {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={chapter} onChange={(e) => setState({ vchapter: Number(e.target.value), vfrom: 1, vto: 5 })} disabled={busy}>
              {Array.from({ length: info.chapters }, (_, i) => <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>)}
            </select>
          </div>
        </label>
        <div className="two">
          <label>From verse
            <input type="number" inputMode="numeric" min="1" max={maxVerse} value={from} disabled={busy}
              onChange={(e) => setState({ vfrom: clamp(Number(e.target.value) || 1, 1, maxVerse) })} />
          </label>
          <label>To verse
            <input type="number" inputMode="numeric" min="1" max={maxVerse} value={to} disabled={busy}
              onChange={(e) => setState({ vto: clamp(Number(e.target.value) || 1, 1, maxVerse) })} />
          </label>
        </div>

        {(voice === 'timer' || voice === 'speech') && <div className="speed">
          <div className="speed-top"><b>{wpm} wpm</b><span>caption pace</span></div>
          <input type="range" min="100" max="260" step="5" value={wpm} onChange={(e) => setState({ vwpm: Number(e.target.value) })} aria-label="Caption pace in words per minute" />
        </div>}

        <div className="row opts">
          <div className="seg" role="group" aria-label="Words on screen">
            {[1, 2, 3, 4].map((k) => <button key={k} type="button" className={k === n ? 'on' : ''} onClick={() => setState({ vchunk: k })}>{k}</button>)}
          </div>
          <span className="muted">words on screen</span>
        </div>
        <div className="row opts">
          <label className="chk"><input type="checkbox" checked={hl} onChange={(e) => setState({ vhl: e.target.checked })} /> Highlight spoken word</label>
          <label className="chk"><input type="checkbox" checked={upper} onChange={(e) => setState({ vupper: e.target.checked })} /> ALL CAPS</label>
        </div>

        <label>Voice
          <select value={voice} onChange={(e) => { setState({ vvoice: e.target.value }); if (e.target.value === 'file' && !narrationEl.current) setTimeout(() => fileInput.current?.click(), 0); }} disabled={busy}>
            <option value="timer">None (timed captions)</option>
            <option value="tts">Synthetic voice (word-synced)</option>
            <option value="file">Narration file</option>
            <option value="speech">Browser voice (preview only)</option>
          </select>
        </label>
        <input ref={fileInput} type="file" accept="audio/*" hidden onChange={(e) => loadNarration(e.target.files[0])} />
        {voice === 'file' && (
          <button type="button" className="ghost" onClick={() => fileInput.current?.click()}>
            {narr ? `${narr.name} · ${narr.secs.toFixed(1)}s (change)` : 'Choose narration audio'}
          </button>
        )}
        {voice === 'tts' && !ttsUrl && <p className="muted">Add your voice endpoint in Settings → Synthetic voice.</p>}
        <p className="muted">Background clip and music are in Settings. Both are baked into the recording.</p>

        {out && (
          <div className="out" ref={outRef}>
            <video src={out.url} controls playsInline />
            <a className="pill dl" href={out.url} download={out.name}><Icon name="download" size={18} /> {out.name} ({out.mb} MB)</a>
          </div>
        )}
      </div>

      <div className="s-actions">
        <button type="button" className="primary" onClick={() => (busy ? stop() : play(false))}>
          <Icon name={mode === 'preview' ? 'stop' : 'play'} size={20} fill /> {mode === 'preview' ? 'Stop' : 'Preview'}
        </button>
        <button type="button" className="rec" onClick={() => (busy ? stop() : play(true))}>
          <Icon name={mode === 'record' ? 'stop' : 'record'} size={20} fill /> {mode === 'record' ? 'Finish' : 'Record'}
        </button>
      </div>
    </div>
  );
}
