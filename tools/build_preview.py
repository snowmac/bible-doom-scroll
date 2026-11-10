"""Assemble dist-preview/ into one self-contained page fragment (title + style + root + script)."""
import pathlib, re
d = pathlib.Path('dist-preview')
js = (d / 'preview.js').read_text(); css = (d / 'preview.css').read_text()
js = re.sub(r'</(script)', r'<\\/\1', js, flags=re.I).replace('<!--', '\\x3C!--')
css = css.replace('</style', '<\\/style')
page = (
    '<title>Scrollword Flash</title>\n'
    '<meta name="claude:viewport-fit-sides" content="cover">\n'
    f'<style>{css}</style>\n'
    '<div id="root"></div>\n'
    f'<script>{js}</script>\n'
)
out = pathlib.Path('scrollword-flash-preview.html'); out.write_text(page)
print(out, len(page) // 1024, 'KB')
