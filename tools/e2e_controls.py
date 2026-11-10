import sys, time, json
from playwright.sync_api import sync_playwright
base, shots = sys.argv[1], sys.argv[2]
errors, r = [], {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(base); pg.wait_for_selector('.card')
    pg.get_by_role('button', name='Flash').click(); pg.wait_for_selector('.f-controls')
    h_open = pg.locator('.f-stage').bounding_box()['height']
    pg.locator('.play').click(); time.sleep(0.4)
    pg.get_by_role('button', name='Hide controls').click(); time.sleep(0.3)
    r['controls_after_hide'] = pg.locator('.f-controls').count()
    r['peek_visible'] = pg.locator('.f-peek').is_visible()
    h_closed = pg.locator('.f-stage').bounding_box()['height']
    r['stage_height_open_vs_closed'] = [round(h_open), round(h_closed)]
    w1 = pg.locator('.f-word').inner_text(); time.sleep(0.5); w2 = pg.locator('.f-word').inner_text()
    r['still_playing_while_hidden'] = w1 != w2
    pg.screenshot(path=f'{shots}/15-controls-hidden.png')
    time.sleep(0.5)  # let persistence flush
    pg.reload(); pg.wait_for_selector('.f-word'); time.sleep(0.4)
    r['hidden_persists_after_reload'] = pg.locator('.f-controls').count() == 0 and pg.locator('.f-peek').count() == 1
    pg.get_by_role('button', name='Show controls').click(); time.sleep(0.3)
    r['restored'] = pg.locator('.f-controls').count() == 1 and pg.locator('.f-peek').count() == 0
    r['wpm_label_after_restore'] = pg.locator('.speed-top b').inner_text()
    b.close()
print(json.dumps(r, indent=1)); print('ERRORS:', errors or 'none')
