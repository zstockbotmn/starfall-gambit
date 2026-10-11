import json
from PIL import Image
im = Image.open('/tmp/sheet-full.png').convert('RGB'); S = im.width / 640
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
    # 8 sample points around the tile (4px inset): corners and edge midpoints; report the WORST contrast
    x0, y0, w = p['x'] - 4, p['y'] - 4, 44
    samp = [avg(x0 + dx, y0 + dy, 1) for dx in (5, 22, 39) for dy in (5, 22, 39) if not (dx == 22 and dy == 22)]
    r = {k: round(min(cr(v, bg) for bg in samp), 1) for k, v in mk.items()}
    r['danger stripe'] = round(min(cr(blend((255, 90, 60), .85, bg), bg) for bg in samp), 1)
    rows[name] = {'bg samples': sorted(set('#%02x%02x%02x' % b for b in samp))[:4], **r}
print(json.dumps(rows, indent=1))
mins = {k: min(rows[n][k] for n in rows) for k in list(mk) + ['danger stripe']}
print('MIN over all square types:', mins)
print('capture vs ships: white on Red hull #2e1040 = %.1f; black outline on Blue hull white = %.1f' % (cr((255,255,255), hexc('#2e1040')), cr((0,0,0),(255,255,255))))
