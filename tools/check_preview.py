import sys, time, json, pathlib
from playwright.sync_api import sync_playwright
frag = pathlib.Path('scrollword-flash-preview.html').read_text()
wrap = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + frag + '</body></html>')
p = pathlib.Path(sys.argv[1]) / 'wrapped.html'; p.write_text(wrap)
errors, res = [], {}
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(p.as_uri()); pg.wait_for_selector('.f-word', timeout=15000)
    seen = set()
    for _ in range(14): seen.add(pg.locator('.f-word').inner_text()); time.sleep(0.15)
    res['distinct_words_autoplay'] = len(seen)
    res['playing_icon_is_pause'] = pg.locator('.play').get_attribute('aria-label')
    res['h_scroll'] = pg.evaluate('document.documentElement.scrollWidth > innerWidth')
    pg.screenshot(path=f'{sys.argv[1]}/preview-flash.png')
    pg.get_by_role('button', name='Choose passage').click(); time.sleep(0.3)
    pg.locator('dialog[open] select').first.select_option('psalms')
    pg.locator('dialog[open] .two select').select_option('23')
    pg.get_by_role('button', name='Go', exact=True).click(); time.sleep(0.8)
    res['after_jump'] = pg.locator('.top .pill').inner_text()
    res['word_after_jump'] = pg.locator('.f-word').inner_text()
    b.close()
print(json.dumps(res, indent=1)); print('ERRORS:', errors or 'none')
