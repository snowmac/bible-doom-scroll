import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { getState } from '../lib/store.js';
import { useEngine } from '../engine.js';

export default function JumpSheet({ open, onClose, onJump }) {
  const { provider } = useEngine();
  return (
    <Sheet open={open} onClose={onClose} title="Go to">
      {open && <JumpForm books={provider.books()} onJump={onJump} />}
    </Sheet>
  );
}

function JumpForm({ books, onJump }) {
  const s = getState();
  const [book, setBook] = useState(books.some((b) => b.id === s.book) ? s.book : books[0].id);
  const [chapter, setChapter] = useState(s.chapter);
  const [verse, setVerse] = useState(1);
  const info = books.find((b) => b.id === book);
  const ch = Math.min(chapter, info.chapters);
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onJump(book, ch, Math.max(1, Number(verse) || 1)); }}>
      <label>Book
        <select value={book} onChange={(e) => { setBook(e.target.value); setChapter(1); }}>
          {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="two">
        <label>Chapter
          <select value={ch} onChange={(e) => setChapter(Number(e.target.value))}>
            {Array.from({ length: info.chapters }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label>Verse
          <input type="number" inputMode="numeric" min="1" value={verse} onChange={(e) => setVerse(e.target.value)} />
        </label>
      </div>
      <button className="primary" type="submit">Go</button>
    </form>
  );
}
