"""Layout checks: long verse on a small phone, desktop widths. Usage: python3 tools/shots.py <base_url> <shots_dir>"""
import sys, time
from playwright.sync_api import sync_playwright
base, shots = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    # small phone, longest-verse territory (Esther 8:9)
    c = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page()
    pg.goto(base); pg.wait_for_selector('.card')
    pg.evaluate("""() => { const s=JSON.parse(localStorage.getItem('scrollword.v1')||'{}'); s.book='esther'; s.chapter=8; s.verse=9; s.mode='scroll'; localStorage.setItem('scrollword.v1', JSON.stringify(s)); }""")
    pg.reload(); pg.wait_for_selector('.card[data-verse="9"]'); time.sleep(0.8)
    pg.screenshot(path=f'{shots}/11-small-long-verse.png')
    ov = pg.evaluate("""() => { const v=document.querySelector('.card[data-verse="9"] .verse'); return {sh:v.scrollHeight, ch:v.clientHeight, fs:getComputedStyle(v).fontSize, len:v.textContent.length} }""")
    print('long verse', ov)
    # flash with a very long word at 360px
    pg.evaluate("""() => { const s=JSON.parse(localStorage.getItem('scrollword.v1')||'{}'); s.mode='flash'; s.book='isaiah'; s.chapter=8; s.verse=1; localStorage.setItem('scrollword.v1', JSON.stringify(s)); }""")
    pg.reload(); pg.wait_for_selector('.f-word'); time.sleep(0.5)
    pg.screenshot(path=f'{shots}/12-small-flash.png')
    c.close()
    # desktop
    c = b.new_context(viewport={'width': 1280, 'height': 800})
    pg = c.new_page(); pg.goto(base); pg.wait_for_selector('.card'); time.sleep(0.5)
    pg.get_by_role('button', name='Scroll').click(); time.sleep(0.8)
    pg.screenshot(path=f'{shots}/13-desktop-scroll.png')
    pg.get_by_role('button', name='Video').click(); time.sleep(0.8)
    pg.screenshot(path=f'{shots}/14-desktop-video.png')
    c.close(); b.close()
