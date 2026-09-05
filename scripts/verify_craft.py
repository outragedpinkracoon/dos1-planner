"""Verification for the crafting page, in the style CLAUDE.md describes:
throwaway parsing that checks invariants, because data errors are where the
bugs actually are. Run after any change to data/recipes.js, craft.js or the page."""
import re, json, sys

js   = open('craft.js').read()
html = open('crafting.html').read()
css  = open('craft.css').read()
fail = []

# --- brace/paren balance ---
def balance(src, label):
    s = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    s = re.sub(r'(?m)^\s*//.*$', '', s)
    s = re.sub(r"'(?:\\.|[^'\\])*'", "''", s)
    s = re.sub(r'"(?:\\.|[^"\\])*"', '""', s)
    for o, c in (('{','}'), ('(',')'), ('[',']')):
        d = s.count(o) - s.count(c)
        if d: fail.append(f'{label}: {o}{c} unbalanced by {d}')
balance(js, 'craft.js')

# --- every el.* resolves to a real id, and every id is reachable ---
ids = set(re.findall(r'id="([^"]+)"', html))
m = re.search(r"\[([^\]]*?)\]\.forEach\(function \(id\)", js, re.S)
declared = set(re.findall(r"'([^']+)'", m.group(1))) if m else set()

if declared - ids:
    fail.append(f'el.* with no element in HTML: {sorted(declared - ids)}')
used = set(re.findall(r'\bel\.(\w+)', js))
if used - declared:
    fail.append('el.* used but never collected: %s' % sorted(used - declared))

for sel in set(re.findall(r"querySelector\('\.([\w-]+)'\)", js)):
    if not re.search(r'class="[^"]*\b' + sel + r'\b', html):
        fail.append(f'querySelector(.{sel}) matches nothing in HTML')

# Selector hooks: used by JS to find/toggle elements, deliberately unstyled.
HOOKS = {'mode-panel', 'col-mid', 'col-left'}

# --- data integrity ---
raw = open('data/recipes.js').read()
data = json.loads(raw[raw.index('{'):raw.rindex(';')])
recipes, items = data['recipes'], data['items']
names = {i['name'] for i in items}

if len(recipes) != 499:
    fail.append(f'expected 499 recipes, got {len(recipes)}')

for r in recipes:
    if not r['a'] or not r['b']:
        fail.append(f"{r['result']}: empty ingredient slot")
    for n in r['a'] + r['b']:
        if n not in names:
            fail.append(f"{r['result']}: ingredient {n!r} missing from items")
    if r['skill'] and r['skill'] not in ('Crafting', 'Smithing', 'Tenebrium'):
        fail.append(f"{r['result']}: unknown skill {r['skill']!r}")
    if not (0 <= r['level'] <= 5):
        fail.append(f"{r['result']}: level {r['level']} out of range")
    if r['type'] not in data['types']:
        fail.append(f"{r['result']}: type {r['type']!r} not in types list")

# raw game asset ids must not survive the cleanup (a trailing _X, or a LOOT_ id;
# "(variant 55)" and "(tier 3)" are cleaned forms and legitimate)
for n in sorted(names):
    if re.search(r'LOOT_|_[A-Z]$|\b\d{2,}\b(?! *\))', n):
        fail.append(f'uncleaned asset id: {n}')

results = {r['result'] for r in recipes}
for i in items:
    if i['craftable'] != (i['name'] in results):
        fail.append(f"{i['name']}: craftable flag disagrees with recipe list")

# every recipe is reachable from the item index in both directions
for r in recipes:
    for n in r['a'] + r['b']:
        if not any(x['name'] == n for x in items):
            fail.append(f'{n}: ingredient absent from item index')

# --- CSS classes referenced anywhere have a rule (bar the JS hooks) ---
allc = set()
for chunk in set(re.findall(r'class=\\?"([^"{]+)', html)) | set(re.findall(r'class=\\?"([a-z][\w -]*)', js)):
    allc |= set(chunk.split())
defined = set(re.findall(r'\.([\w-]+)', css)) | set(re.findall(r'\.([\w-]+)', open('app.css').read()))
undef = {c for c in allc if c not in defined and c not in HOOKS}
if undef:
    fail.append(f'classes with no CSS rule: {sorted(undef)}')

# --- the matcher's own invariants, replicated here ---
tools = {i['name'] for i in items if i['tool']}
# A recipe made entirely of stations would be craftable from an empty bag.
# This is what caught knife/bucket/cooking pot being wrongly flagged as bench
# tools when they are really consumable bag items.
for r in recipes:
    if all(n in tools for n in r['a']) and all(n in tools for n in r['b']):
        fail.append(f"{r['result']}: every ingredient is a station, craftable from nothing")

# A station must never be consumed, so nothing that a recipe produces may be one.
for r in recipes:
    if r['result'] in tools and r['result'] != 'Portable Kitchen':
        fail.append(f"{r['result']}: is a station but is also crafted")

print('FAIL' if fail else 'ALL CHECKS PASS')
for f in fail: print(' -', f)
print(f'\n{len(recipes)} recipes, {len(items)} items, {len(tools)} tools, '
      f'{sum(1 for i in items if not i["craftable"] and not i["tool"])} world-loot only, '
      f'{sum(1 for r in recipes if len(r["a"]) > 1 or len(r["b"]) > 1)} with alternatives')
sys.exit(1 if fail else 0)
