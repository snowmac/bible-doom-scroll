"""Subset of the WEB for the standalone Flash preview. Usage: python3 tools/make_preview_data.py"""
import json
keep = ['genesis','psalms','proverbs','ecclesiastes','isaiah','matthew','luke','john','romans','1corinthians','james','revelation']
d = json.load(open('public/data/web.json'))
books = [b for b in d['books'] if b['id'] in keep]
books.sort(key=lambda b: keep.index(b['id']))
json.dump({'books': books}, open('src/preview-data.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import os
print(len(books), 'books', os.path.getsize('src/preview-data.json') // 1024, 'KB')
