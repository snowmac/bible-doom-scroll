// Text providers. Everything in the app talks to this interface only:
//   await init()
//   books()                      -> [{id, name, chapters}]
//   await chapter(bookId, n)     -> [{n, text}]
//   label, attribution, license

export class LocalWebProvider {
  constructor() {
    this.id = 'web';
    this.label = 'World English Bible';
    this.attribution = 'World English Bible (public domain)';
    this.license = 'public-domain';
  }
  async init() {
    const r = await fetch(`${import.meta.env?.BASE_URL ?? './'}data/web.json`);
    if (!r.ok) throw new Error('Could not load data/web.json');
    this.data = await r.json();
    this.byId = new Map(this.data.books.map((b) => [b.id, b]));
  }
  books() {
    return this.data.books.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters.length }));
  }
  async chapter(bookId, n) {
    const b = this.byId.get(bookId);
    const ch = b?.chapters[n - 1];
    if (!ch) return [];
    return ch.map((text, i) => ({ n: i + 1, text })).filter((v) => v.text);
  }
}

// UNTESTED against the live service (no key was available while building).
// Endpoints/params follow API.Bible's REST docs as I know them; verify first run.
// Licensing: attribution is required on every display for copyrighted translations,
// cached text must be refreshed (30 days max per their policy page), FUMS is required
// for web apps, and sub-licensing is not allowed. Never ship the API key in client code.
export class ApiBibleProvider {
  constructor({ apiKey, bibleId, label = 'API.Bible', attribution = '' }) {
    this.id = 'apibible';
    this.apiKey = apiKey; this.bibleId = bibleId;
    this.label = label; this.attribution = attribution;
    this.license = 'licensed';
    this.base = 'https://rest.api.bible/v1';
    this.cache = new Map();
  }
  async #get(path) {
    const r = await fetch(this.base + path, { headers: { 'api-key': this.apiKey } });
    if (!r.ok) throw new Error(`API.Bible ${r.status} on ${path}`);
    return r.json();
  }
  async init() {
    const j = await this.#get(`/bibles/${this.bibleId}/books?include-chapters=true`);
    this._books = j.data.map((b) => ({
      id: b.id, name: b.name,
      chapters: (b.chapters || []).filter((c) => /^\d+$/.test(String(c.number))).length,
    }));
    try {
      const meta = await this.#get(`/bibles/${this.bibleId}`);
      this.attribution = meta.data.copyright || this.attribution;
      this.label = meta.data.abbreviationLocal || meta.data.name || this.label;
    } catch { /* non-fatal */ }
  }
  books() { return this._books; }
  async chapter(bookId, n) {
    const key = `${bookId}.${n}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const q = 'content-type=text&include-verse-numbers=true&include-titles=false&include-notes=false&include-chapter-numbers=false';
    const j = await this.#get(`/bibles/${this.bibleId}/chapters/${key}?${q}`);
    const verses = parseNumberedText(j.data.content);
    this.cache.set(key, verses);
    return verses;
  }
}

// "[1] In the beginning... [2] The earth was..." -> [{n, text}]
export function parseNumberedText(raw) {
  const out = [];
  const re = /\[(\d+)\]\s*/g;
  let m, last = null;
  while ((m = re.exec(raw)) !== null) {
    if (last) out.push({ n: last.n, text: raw.slice(last.end, m.index).replace(/\s+/g, ' ').trim() });
    last = { n: Number(m[1]), end: re.lastIndex };
  }
  if (last) out.push({ n: last.n, text: raw.slice(last.end).replace(/\s+/g, ' ').trim() });
  return out.filter((v) => v.text);
}
