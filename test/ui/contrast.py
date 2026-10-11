import json
from PIL import Image
im = Image.open('/tmp/sheet-full.png').convert('RGB'); S = im.width / 390
pts = json.load(open('/tmp/sheet-bg.json'))
def lum(c):
    def ch(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c; return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
def cr(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def blend(fg, a, bg): return tuple(round(fg[i] * a + bg[i] * (1 - a)) for i in range(3))
def avg(x, y, r=2):
    px = [im.getpixel((int(x * S) + dx, int(y * S) + dy)) for dx in range(-r, r + 1) for dy in range(-r, r + 1)]
    return tuple(sum(p[i] for p in px) // len(px) for i in range(3))
mk = {'move dot': hexc('#5cffc8'), 'lane plus': hexc('#ffc23d'), 'capture brackets': hexc('#ffffff'), 'enemy-move ring': hexc('#ff8fe0'), "'!' badge": hexc('#ffd23f'), 'selection ring': hexc('#5cffc8'), 'enemy selection ring': hexc('#ff2bd6')}
rows = {}
for name, p in pts.items():
    bg = avg(p['x'] + 2, p['y'] + 2)
    r = {k: round(cr(v, bg), 1) for k, v in mk.items()}
    r['danger stripe'] = round(cr(blend((255, 90, 60), .85, bg), bg), 1)
    rows[name] = {'bg': '#%02x%02x%02x' % bg, **r}
print(json.dumps(rows, indent=1))
mins = {k: min(rows[n][k] for n in rows) for k in list(mk) + ['danger stripe']}
print('MIN over all square types:', mins)
print('capture vs ships: white on Red hull #2e1040 = %.1f; black outline on Blue hull white = %.1f' % (cr((255,255,255), hexc('#2e1040')), cr((0,0,0),(255,255,255))))
