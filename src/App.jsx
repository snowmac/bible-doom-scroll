import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineContext } from './engine.js';
import { Background } from './lib/background.js';
import { AudioEngine } from './lib/audio.js';
import { LocalWebProvider, ApiBibleProvider } from './lib/providers.js';
import { getState, setState, useStore } from './lib/store.js';
import BackgroundCanvas from './components/BackgroundCanvas.jsx';
import ScrollFeed from './components/ScrollFeed.jsx';
import FlashReader from './components/FlashReader.jsx';
import VideoStudio from './components/VideoStudio.jsx';
import JumpSheet from './components/JumpSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import Icon from './components/Icon.jsx';

const bg = new Background();
const audio = new AudioEngine();

const MODES = { scroll: ScrollFeed, flash: FlashReader, video: VideoStudio };
const TABS = [['scroll', 'Scroll'], ['flash', 'Flash'], ['video', 'Video']];

export default function App() {
  const mode = useStore((s) => s.mode);
  const source = useStore((s) => s.source);
  const apiKey = useStore((s) => s.apiKey);
  const bibleId = useStore((s) => s.bibleId);
  const bgKind = useStore((s) => s.bgKind);
  const volume = useStore((s) => s.volume);

  const [provider, setProvider] = useState(null);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');
  const [jumpKey, setJumpKey] = useState(0);
  const [sheet, setSheet] = useState(null);           // 'jump' | 'settings' | null
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(0);
  const musicFile = useRef(null);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const applyMusic = useCallback(async () => {
    try { await audio.apply(getState().music, musicFile.current); }
    catch (e) { toast(`Audio: ${e.message}`); }
  }, [toast]);

  // text provider (bundled WEB by default, API.Bible when connected)
  useEffect(() => {
    let dead = false;
    setError('');
    (async () => {
      let p;
      try {
        if (source === 'apibible' && apiKey && bibleId) p = new ApiBibleProvider({ apiKey, bibleId });
        else p = new LocalWebProvider();
        await p.init();
      } catch (e) {
        if (dead) return;
        if (source === 'apibible') { toast(`API.Bible failed (${e.message}). Back to WEB.`); setState({ source: 'web' }); }
        else setError(e.message);
        return;
      }
      if (dead) return;
      const books = p.books(), s = getState();
      if (!books.some((b) => b.id === s.book)) setState({ book: books[0].id, chapter: 1, verse: 1 });
      if (!books.some((b) => b.id === s.vbook)) setState({ vbook: books[0].id, vchapter: 1, vfrom: 1, vto: 5 });
      const cur = getState();
      setRef(`${books.find((b) => b.id === cur.book).name} ${cur.chapter}:${cur.verse}`);
      setProvider(p);
    })();
    return () => { dead = true; };
  }, [source, apiKey, bibleId, toast]);

  useEffect(() => { bg.setKind(bgKind); }, [bgKind]);
  useEffect(() => { audio.setVolume(volume); }, [volume]);

  // browsers need a gesture before audio can start; resume remembered ambient music on first touch
  useEffect(() => {
    if (getState().music === 'file') setState({ music: 'off' });   // a picked file doesn't survive reloads
    const kick = () => { if (getState().music === 'ambient') applyMusic(); };
    window.addEventListener('pointerdown', kick, { once: true });
    return () => window.removeEventListener('pointerdown', kick);
  }, [applyMusic]);

  const jump = useCallback((book, chapter, verse = 1) => {
    setState({ book, chapter, verse, vbook: book, vchapter: chapter, vfrom: verse, vto: verse + 4 });
    setJumpKey((k) => k + 1);
    setSheet(null);
  }, []);

  const engine = useMemo(() => ({ provider, bg, audio, setRef, toast, applyMusic }), [provider, toast, applyMusic]);
  const Mode = MODES[mode] || ScrollFeed;

  return (
    <EngineContext.Provider value={engine}>
      <BackgroundCanvas bg={bg} paused={mode === 'video'} />
      <div className="app" data-mode={mode}>
        <header className="top">
          <button type="button" className="pill" onClick={() => provider && setSheet('jump')} aria-label="Choose passage">{ref || 'Scrollword'}</button>
          <button type="button" className="icon" onClick={() => setSheet('settings')} aria-label="Settings"><Icon name="sliders" /></button>
        </header>

        <main className="stage">
          {error && <div className="loading"><div><p>{error}</p><button className="primary" onClick={() => location.reload()}>Retry</button></div></div>}
          {!error && !provider && <div className="loading">Loading…</div>}
          {provider && <Mode key={`${provider.id}:${jumpKey}`} />}
        </main>

        <nav className="tabs" aria-label="Modes">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-current={mode === id} onClick={() => setState({ mode: id })}>
              <Icon name={id} size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {provider && (
        <>
          <JumpSheet open={sheet === 'jump'} onClose={() => setSheet(null)} onJump={jump} />
          <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} onJump={jump} musicFile={musicFile} />
        </>
      )}
      <div className="toast" role="status" data-show={!!toastMsg}>{toastMsg}</div>
    </EngineContext.Provider>
  );
}
