"""Headless-Chrome smoke test at a phone viewport. Usage: python3 tools/e2e.py <base_url> <shots_dir>"""
import sys, time, json
from playwright.sync_api import sync_playwright

base, shots = sys.argv[1], sys.argv[2]
errors, results = [], {}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
                          args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

    page.goto(base)
    page.wait_for_selector('.card', timeout=15000)
    time.sleep(0.6)
    results['cards_initial'] = page.locator('.card').count()
    results['ref_initial'] = page.locator('.top .pill').inner_text()
    page.screenshot(path=f'{shots}/01-scroll.png')

    # swipe through a few verses
    feed = page.locator('.feed')
    for _ in range(4):
        page.evaluate("document.querySelector('.feed').scrollBy({top: document.querySelector('.feed').clientHeight, behavior: 'instant'})")
        time.sleep(0.35)
    results['ref_after_scroll'] = page.locator('.top .pill').inner_text()
    results['read_hud'] = page.locator('.hud').inner_text().replace('\n', ' | ')
    page.screenshot(path=f'{shots}/02-scroll-after.png')

    # double tap to save
    page.locator('.card[data-verse]').nth(0)
    active = page.evaluate("""() => { const f=document.querySelector('.feed'); const r=f.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return el && el.closest('.card') ? el.closest('.card').dataset.verse : null }""")
    results['active_verse'] = active
    page.mouse.dblclick(195, 400)
    time.sleep(0.2)
    results['saved_in_storage'] = len(json.loads(page.evaluate("localStorage.getItem('scrollword.v1')") or '{}').get('saved', []))
    time.sleep(0.5)
    results['saved_in_storage'] = len(json.loads(page.evaluate("localStorage.getItem('scrollword.v1')") or '{}').get('saved', []))

    # infinite append: jump to the end of a chapter
    page.evaluate("document.querySelector('.feed').scrollTo({top: 1e9, behavior: 'instant'})")
    time.sleep(0.8)
    results['cards_after_end_jump'] = page.locator('.card').count()
    results['chapters_loaded'] = page.locator('.card.head').count()

    # flash
    page.get_by_role('button', name='Flash').click()
    page.wait_for_selector('.f-word')
    page.screenshot(path=f'{shots}/03-flash-paused.png')
    page.locator('.play').click()
    seen = set()
    for _ in range(12):
        seen.add(page.locator('.f-word').inner_text()); time.sleep(0.15)
    results['flash_distinct_words'] = len(seen)
    page.screenshot(path=f'{shots}/04-flash-playing.png')
    page.locator('.chips button', has_text='800').click()
    time.sleep(0.2)
    results['flash_wpm_label'] = page.locator('.speed-top b').inner_text()
    page.locator('.play').click()   # pause

    # video studio
    page.get_by_role('button', name='Video').click()
    page.wait_for_selector('.studio canvas')
    page.locator('input[type=number]').nth(1).fill('1')
    time.sleep(0.5)
    page.screenshot(path=f'{shots}/05-video.png', full_page=False)
    page.get_by_role('button', name='Preview').click()
    time.sleep(1.8)
    page.screenshot(path=f'{shots}/06-video-preview.png')
    page.get_by_role('button', name='Stop').click()
    time.sleep(0.3)
    page.get_by_role('button', name='Record').click()
    try:
        page.wait_for_selector('.out video', timeout=30000)
        info = page.evaluate("""async () => { const v=document.querySelector('.out video'); const r=await fetch(v.src); const b=await r.blob(); return {type:b.type,size:b.size} }""")
        results['recording'] = info
        results['download_name'] = page.locator('.dl').get_attribute('download')
    except Exception as e:
        results['recording'] = f'FAILED: {e}'
    page.screenshot(path=f'{shots}/07-video-done.png')

    # sheets
    page.get_by_role('button', name='Settings').click(); time.sleep(0.4)
    page.screenshot(path=f'{shots}/08-settings.png')
    page.keyboard.press('Escape'); time.sleep(0.3)
    page.get_by_role('button', name='Scroll').click(); time.sleep(0.5)
    page.get_by_role('button', name='Choose passage').click(); time.sleep(0.4)
    page.locator('dialog[open] select').first.select_option('psalms')
    page.locator('dialog[open] .two select').select_option('23')
    page.screenshot(path=f'{shots}/09-jump.png')
    page.get_by_role('button', name='Go', exact=True).click(); time.sleep(1.0)
    results['after_jump_ref'] = page.locator('.top .pill').inner_text()
    results['after_jump_verse_text'] = page.locator('.card[data-verse="1"] .verse').first.inner_text()
    page.screenshot(path=f'{shots}/10-after-jump.png')
    b.close()

print(json.dumps(results, indent=2))
print('ERRORS:', json.dumps(errors, indent=2) if errors else 'none')
