// Standalone Flash-only preview: the real FlashReader + JumpSheet over a small in-memory text provider.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import data from './preview-data.json';
import { EngineContext } from './engine.js';
import { Background } from './lib/background.js';
import { setState } from './lib/store.js';
import BackgroundCanvas from './components/BackgroundCanvas.jsx';
import FlashReader from './components/FlashReader.jsx';
import JumpSheet from './components/JumpSheet.jsx';
import './styles.css';
import './preview.css';

class MemoryProvider {
  constructor(books) {
    this.id = 'memory';
    this.label = 'World English Bible';
    this.attribution = 'World English Bible (public domain)';
    this.byId = new Map(books.map((b) => [b.id, b]));
    this._books = books.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters.length }));
  }
  books() { return this._books; }
  async chapter(id, n) {
    const ch = this.byId.get(id)?.chapters[n - 1] || [];
    return ch.map((text, i) => ({ n: i + 1, text })).filter((v) => v.text);
  }
}

const provider = new MemoryProvider(data.books);
const bg = new Background();
const audio = { ensure() {}, tick() {}, setVolume() {} };
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Preview() {
  const [ref, setRef] = useState('John 1:1');
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const engine = useMemo(() => ({ provider, bg, audio, setRef, toast() {}, applyMusic() {} }), []);
  const jump = (book, chapter, verse) => {
    setState({ book, chapter, verse });
    setKey((k) => k + 1);
    setOpen(false);
  };
  return (
    <EngineContext.Provider value={engine}>
      <BackgroundCanvas bg={bg} paused={!!reduceMotion} />
      <div className="app" data-mode="flash">
        <header className="top">
          <button type="button" className="pill" onClick={() => setOpen(true)} aria-label="Choose passage">{ref}</button>
          <span className="tag">Flash preview</span>
        </header>
        <main className="stage"><FlashReader key={key} autoplay /></main>
      </div>
      <JumpSheet open={open} onClose={() => setOpen(false)} onJump={jump} />
    </EngineContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><Preview /></StrictMode>);
