import json, re, sys, os
src, out = sys.argv[1], sys.argv[2]
books = [("genesis","Genesis"),("exodus","Exodus"),("leviticus","Leviticus"),("numbers","Numbers"),("deuteronomy","Deuteronomy"),("joshua","Joshua"),("judges","Judges"),("ruth","Ruth"),("1samuel","1 Samuel"),("2samuel","2 Samuel"),("1kings","1 Kings"),("2kings","2 Kings"),("1chronicles","1 Chronicles"),("2chronicles","2 Chronicles"),("ezra","Ezra"),("nehemiah","Nehemiah"),("esther","Esther"),("job","Job"),("psalms","Psalms"),("proverbs","Proverbs"),("ecclesiastes","Ecclesiastes"),("songofsolomon","Song of Solomon"),("isaiah","Isaiah"),("jeremiah","Jeremiah"),("lamentations","Lamentations"),("ezekiel","Ezekiel"),("daniel","Daniel"),("hosea","Hosea"),("joel","Joel"),("amos","Amos"),("obadiah","Obadiah"),("jonah","Jonah"),("micah","Micah"),("nahum","Nahum"),("habakkuk","Habakkuk"),("zephaniah","Zephaniah"),("haggai","Haggai"),("zechariah","Zechariah"),("malachi","Malachi"),("matthew","Matthew"),("mark","Mark"),("luke","Luke"),("john","John"),("acts","Acts"),("romans","Romans"),("1corinthians","1 Corinthians"),("2corinthians","2 Corinthians"),("galatians","Galatians"),("ephesians","Ephesians"),("philippians","Philippians"),("colossians","Colossians"),("1thessalonians","1 Thessalonians"),("2thessalonians","2 Thessalonians"),("1timothy","1 Timothy"),("2timothy","2 Timothy"),("titus","Titus"),("philemon","Philemon"),("hebrews","Hebrews"),("james","James"),("1peter","1 Peter"),("2peter","2 Peter"),("1john","1 John"),("2john","2 John"),("3john","3 John"),("jude","Jude"),("revelation","Revelation")]
result = {"translation": "WEB", "name": "World English Bible", "license": "Public Domain", "books": []}
total = 0
for bid, name in books:
    verses = {}
    for o in json.load(open(os.path.join(src, bid + ".json"))):
        if o.get("type") in ("paragraph text", "line text"):
            c, v = o["chapterNumber"], o["verseNumber"]
            verses.setdefault(c, {}).setdefault(v, []).append(o["value"])
    chapters = []
    for c in sorted(verses):
        mx = max(verses[c])
        arr = [""] * mx
        for v, parts in verses[c].items():
            arr[v - 1] = re.sub(r"\s+", " ", " ".join(parts)).strip()
            total += 1
        chapters.append(arr)
    result["books"].append({"id": bid, "name": name, "chapters": chapters})
json.dump(result, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print("books", len(result["books"]), "verses", total, "bytes", os.path.getsize(out))
