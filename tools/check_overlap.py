import sys, time, json, pathlib
from playwright.sync_api import sync_playwright
frag = pathlib.Path('scrollword-flash-preview.html').read_text()
wrap = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light}body{margin:0}</style></head><body>' + frag + '</body></html>')
wp = pathlib.Path(sys.argv[1]) / 'wrapped.html'; wp.write_text(wrap)
out, errors = {}, []
def measure(pg, label):
    pg.get_by_role('button', name='Hide controls').click(); time.sleep(0.4)
    ctx = pg.locator('.f-context').bounding_box(); peek = pg.locator('.f-peek').bounding_box(); bar = pg.locator('.f-bar').bounding_box()
    out[label] = {'controls_gone': pg.locator('.f-controls').count() == 0,
                  'peek_clear_of_context': peek['y'] >= ctx['y'] + ctx['height'] - 1,
                  'peek_clear_of_bar': peek['y'] >= bar['y'] + bar['height'] - 1,
                  'peek_in_viewport': peek['y'] + peek['height'] <= pg.viewport_size['height'] }
    pg.get_by_role('button', name='Show controls').click(); time.sleep(0.2)
    out[label]['restored'] = pg.locator('.f-controls').count() == 1
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('file://' + str(wp)); pg.wait_for_selector('.f-controls'); time.sleep(0.5)
    measure(pg, 'preview_page')
    pg2 = c.new_page(); pg2.on('pageerror', lambda e: errors.append(str(e)))
    pg2.goto(sys.argv[2]); pg2.wait_for_selector('.card'); pg2.get_by_role('button', name='Flash').click(); pg2.wait_for_selector('.f-controls'); time.sleep(0.3)
    measure(pg2, 'main_app')
    b.close()
print(json.dumps(out, indent=1)); print('ERRORS:', errors or 'none')
