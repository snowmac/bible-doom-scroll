# Scrollword (working name)

Mobile-first React PWA that turns scripture into addictive formats. One text layer, three modes.

- **Scroll**: full-screen snap feed, one verse per card, infinite across chapters and books. Background hue drifts per verse, optional haptic or sound tick, double-tap to save, streak and verses-read counters.
- **Flash**: RSVP reader. One to three words at a time, 100 to 1000 wpm, ORP focus letter, punctuation pauses, current-verse context line, jump 10 words or a verse.
- **Video**: 9:16 caption video generator. Word-chunk captions with highlighted spoken word over an animated or uploaded background, optional narration file and music, records to MP4 (WebM fallback) fully in the browser.

## Run

```
npm install
npm run dev        # --host is on, open the LAN URL on your phone
npm run build      # static output in dist/, deploy to Cloudflare Pages as is
npm test           # engine unit tests (timeline math, providers, 31k verse sanity check)
```

`tools/e2e.py` is a Playwright smoke test at a 390x844 touch viewport (it hardcodes /usr/bin/google-chrome).
`tools/build_web.py` rebuilds `public/data/web.json` from the TehShrike/world-english-bible repo JSON.

## Deploy to Cloudflare

- **Dashboard (Git integration):** Workers & Pages -> Create -> connect this repo. Build command `npm run build`, deploy command `npx wrangler deploy` (the default). `wrangler.toml` serves `dist/` as Workers static assets with SPA fallback.
- **CLI:** `npx wrangler login`, then `npm run deploy`.
- `public/_headers` sets long-lived caching for hashed assets and no-cache for `index.html`, `sw.js` and the manifest. The service worker fetches navigations network-first, so new deploys show up on reload.
- The TTS Worker deploys separately from `worker/` (see below).

## Layout

```
src/lib/        framework-free engines
  timeline.js     tokenizing, wpm scheduling, ORP split
  providers.js    TextProvider interface: LocalWebProvider, ApiBibleProvider (untested)
  background.js   shared animated background (aurora, embers, stars, waves, video)
  audio.js        generative ambient pad, music file, tick, mix tap for the recorder
  narrators.js    Timer / File / Speech narrators that drive the video studio
  caption.js      canvas caption renderer
  recorder.js     canvas + audio MediaRecorder wrapper
  store.js        tiny persisted store + useStore(selector) hook
src/components/ ScrollFeed, FlashReader, VideoStudio, sheets
```

## Synthetic voice (word-synced)

Video tab -> Voice -> "Synthetic voice". The app posts the passage text to a voice endpoint and gets back
`{audio (base64), mime, words:[{start,end}], aligned}`; captions then follow the real word times, and the voice is mixed into the recording.

- `worker/` is a Cloudflare Worker that implements the endpoint with ElevenLabs `with-timestamps` (character times grouped into words in `src/lib/align.js`).
  Deploy: `cd worker && npx wrangler secret put ELEVENLABS_API_KEY`, set `ELEVENLABS_VOICE_ID` in wrangler.toml, `npx wrangler deploy`, then paste the URL in Settings -> Synthetic voice.
- Another provider only needs to return the same JSON; only `worker/index.js` knows about ElevenLabs.
- Tested against `tools/mock-tts.mjs` (known timings): `node tools/mock-tts.mjs`, then `python3 tools/e2e_tts.py <app_url> http://localhost:8787 <shots_dir>`.
- NOT tested against the live ElevenLabs API (no key). Verify the auth header and response shape on first run. The Worker has no auth or rate limit yet: add both before sharing the URL. Requests are capped at 4000 characters.
- Check the ElevenLabs plan's commercial-use terms before publishing videos.

## Text and licensing

- Bundled text is the World English Bible (public domain), so everything works offline and nothing needs a key.
- Berean Standard Bible is also public domain (dedicated April 30, 2023, all uses permitted incl. commercial). It is more modern than WEB. Not bundled yet; it only needs a data file in the same shape as `web.json`.
- API.Bible (from their support pages): Open Access translations (public domain and CC) are free on all plans. Commercial use needs a Pro plan. NKJV, NASB, CSB, NLT, CEV are available commercially. NIV is not available commercially through them and ESV is not available at all. Attribution is required on every display, FUMS is required for web apps, cached text must refresh at least every 30 days, and sub-licensing is not allowed. Their pages do not say anything about audio or video derivatives, so ask support@api.bible before building the video stream on a licensed translation.
- Sources: https://care.api.bible/article/396-licensing-policies-quick-reference , https://care.api.bible/article/384-understanding-commercial-use , https://berean.bible/terms.htm

## Known limits

- Browser speech synthesis can be previewed but not recorded. For a real voice-over, generate audio server-side (Worker plus a TTS API) and feed it in as a narration file.
- Narration-file caption timing is the text schedule stretched to the audio length. Good enough for a POC, not forced alignment.
- Recording runs in real time. Not tested on iOS Safari.
- The scroll feed appends chapters and never drops old ones. Add windowing before shipping.
- `ApiBibleProvider` has never talked to the live service. Verify endpoints, verse-number format and FUMS, and move calls behind a Worker so the key is not in the client.
- No background footage is included. Use your own or properly licensed clips.
