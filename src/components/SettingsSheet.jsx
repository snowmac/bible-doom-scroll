import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { KINDS } from '../lib/background.js';
import { getState, setState, useStore } from '../lib/store.js';
import { useEngine } from '../engine.js';

function Seg({ value, options, onChange }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export default function SettingsSheet({ open, onClose, onJump, musicFile }) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      {open && <Body onClose={onClose} onJump={onJump} musicFile={musicFile} />}
    </Sheet>
  );
}

function Body({ onJump, musicFile }) {
  const { bg, audio, applyMusic, toast, provider } = useEngine();
  const bgKind = useStore((s) => s.bgKind);
  const music = useStore((s) => s.music);
  const volume = useStore((s) => s.volume);
  const haptics = useStore((s) => s.haptics);
  const tick = useStore((s) => s.tick);
  const source = useStore((s) => s.source);
  const streak = useStore((s) => s.streak);
  const read = useStore((s) => s.versesRead);
  const [key, setKey] = useState(getState().apiKey);
  const [bibleId, setBibleId] = useState(getState().bibleId);
  const ttsUrl = useStore((s) => s.ttsUrl);
  const ttsVoice = useStore((s) => s.ttsVoice);
  const [hasVideo, setHasVideo] = useState(!!bg.video);

  return (
    <div className="form">
      <p className="muted">{streak ? `🔥 ${streak} day streak · ` : ''}{read} verses read</p>

      <section>
        <h3>Background</h3>
        <Seg value={bgKind} options={KINDS} onChange={(k) => { setState({ bgKind: k }); bg.setKind(k); }} />
        <label className="file">Background video (your own or licensed footage)
          <input type="file" accept="video/*" onChange={(e) => { bg.setVideo(e.target.files[0] || null); setHasVideo(!!e.target.files[0]); }} />
        </label>
        {hasVideo && <button type="button" className="ghost" onClick={() => { bg.setVideo(null); setHasVideo(false); }}>Remove video</button>}
      </section>

      <section>
        <h3>Music</h3>
        <Seg value={music} options={['off', 'ambient', 'file']} onChange={async (m) => {
          setState({ music: m });
          if (m !== 'file') await applyMusic();
        }} />
        {music === 'file' && (
          <label className="file">Audio file (loops)
            <input type="file" accept="audio/*" onChange={async (e) => { musicFile.current = e.target.files[0] || null; await applyMusic(); }} />
          </label>
        )}
        <label>Volume
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => { const v = Number(e.target.value); setState({ volume: v }); audio.setVolume(v); }} />
        </label>
      </section>

      <section>
        <h3>Feel</h3>
        <label className="chk"><input type="checkbox" checked={haptics} onChange={(e) => setState({ haptics: e.target.checked })} /> Haptic tick on each verse</label>
        <label className="chk"><input type="checkbox" checked={tick} onChange={(e) => { setState({ tick: e.target.checked }); if (e.target.checked) { audio.ensure(); audio.tick(); } }} /> Sound tick on each verse</label>
      </section>

      <section>
        <h3>Synthetic voice</h3>
        <label>Voice endpoint<input value={ttsUrl} onChange={(e) => setState({ ttsUrl: e.target.value.trim() })} placeholder="https://your-worker.workers.dev" autoComplete="off" /></label>
        <label>Voice ID (optional)<input value={ttsVoice} onChange={(e) => setState({ ttsVoice: e.target.value.trim() })} autoComplete="off" /></label>
        <p className="muted">Your deployed Worker (see worker/). The ElevenLabs key lives in the Worker, never in the app. Choose "Synthetic voice" in the Video tab.</p>
      </section>

      <section>
        <h3>Text source</h3>
        <Seg value={source === 'apibible' ? 'API.Bible' : 'web'} options={['web', 'API.Bible']} onChange={(o) => {
          if (o === 'web') setState({ source: 'web' });
        }} />
        <p className="muted">{source === 'web' ? 'World English Bible, public domain. Bundled, works offline.' : provider.label}</p>
        <details>
          <summary>Connect API.Bible (prototype only)</summary>
          <label>API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <label>Bible ID<input value={bibleId} onChange={(e) => setBibleId(e.target.value.trim())} placeholder="e.g. a Bible ID from api.bible/bibles" /></label>
          <p className="muted">The key is stored in this browser and sent from the client. Fine for a spike, not for production: move calls behind a Worker. Check the translation's license before making videos with it.</p>
          <button type="button" className="primary" disabled={!key || !bibleId}
            onClick={() => { setState({ source: 'apibible', apiKey: key, bibleId }); toast('Connecting…'); }}>Connect</button>
        </details>
      </section>

      <Saved onJump={onJump} />
    </div>
  );
}

function Saved({ onJump }) {
  const { provider } = useEngine();
  const saved = useStore((s) => s.saved);
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let dead = false;
    const names = new Map(provider.books().map((b) => [b.id, b.name]));
    Promise.all(saved.map(async (s) => {
      const v = (await provider.chapter(s.book, s.chapter)).find((x) => x.n === s.verse);
      return { ...s, ref: `${names.get(s.book) || s.book} ${s.chapter}:${s.verse}`, text: v?.text || '' };
    })).then((r) => { if (!dead) setRows(r.reverse()); }).catch(() => {});
    return () => { dead = true; };
  }, [saved, provider]);
  return (
    <section>
      <h3>Saved verses</h3>
      {!rows.length && <p className="muted">Double-tap a verse or tap the heart to save it.</p>}
      <ul className="saved">
        {rows.map((r) => (
          <li key={`${r.book}${r.chapter}${r.verse}`}>
            <button type="button" onClick={() => onJump(r.book, r.chapter, r.verse)}>
              <b>{r.ref}</b><span>{r.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
