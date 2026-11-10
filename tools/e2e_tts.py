"""Word-sync test against the mock voice server.
Usage: python3 tools/e2e_tts.py <app_url> <mock_url> <shots_dir>
Captures the timings the server returned, then checks the caption word index against the audio clock."""
import sys, time, json
from playwright.sync_api import sync_playwright

base, mock, shots = sys.argv[1], sys.argv[2], sys.argv[3]
errors, timings = [], []

def on_resp(r):
    if r.url.rstrip('/') == mock.rstrip('/') and r.request.method == 'POST':
        timings[:] = r.json()['words']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
                          args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', on_resp)
    page.goto(base); page.wait_for_selector('.card')
    page.evaluate("""(u) => { const s = JSON.parse(localStorage.getItem('scrollword.v1')||'{}');
        s.ttsUrl=u; s.vvoice='tts'; s.vchunk=1; localStorage.setItem('scrollword.v1', JSON.stringify(s)); }""", mock)
    page.reload(); page.wait_for_selector('.card')
    page.get_by_role('button', name='Video').click()
    page.wait_for_selector('.s-status')
    page.get_by_role('button', name='Preview').click()
    page.wait_for_function("document.querySelector('.s-preview canvas').dataset.t", timeout=15000)

    samples = []
    end = time.time() + 40
    while time.time() < end:
        d = page.evaluate("(() => { const c=document.querySelector('.s-preview canvas'); return [c.dataset.word, c.dataset.t] })()")
        if d[1]: samples.append((int(d[0]), float(d[1])))
        if page.locator('.s-status').count() and 'words' in page.locator('.s-status').inner_text() and len(samples) > 10:
            break  # back to idle
        time.sleep(0.03)
    page.screenshot(path=f'{shots}/tts-preview.png')

    # record run
    page.wait_for_function("document.querySelector('.s-status')?.innerText.includes('words')", timeout=20000)
    page.get_by_role('button', name='Record').click()
    page.wait_for_selector('.out video', timeout=60000)
    info = page.evaluate("""async () => { const v=document.querySelector('.out video'); const r=await fetch(v.src); const b=await r.blob(); return {type:b.type,size:b.size} }""")
    b.close()

assert timings, 'no timings captured from mock'
def expected(t):
    i = 0
    for k, w in enumerate(timings):
        if w['start'] * 1000 <= t * 1000: i = k
    return i
bad = [(w, t, expected(t)) for w, t in samples if abs(w - expected(t)) > 0]
# allow one frame of slack at boundaries (clock read vs rAF draw)
hard = [x for x in bad if abs(x[0] - x[2]) > 1]
print('words', len(timings), 'samples', len(samples), 'off-by-one', len(bad) - len(hard), 'off>1', len(hard))
print('last word shown', samples[-1][0], 'of', len(timings) - 1, '| video', info, '| errors', errors)
assert not hard and samples[-1][0] == len(timings) - 1 and info['size'] > 10000 and not errors
print('OK')
