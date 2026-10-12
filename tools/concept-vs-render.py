# Builds screenshots/m3/assets/concept-vs-render.png: each fleet's concept image on the left, the 4 ship close-ups on the right.
from PIL import Image, ImageDraw
import os
R = os.path.dirname(__file__) + '/..'; A = R + '/screenshots/m3/assets/'; S = R + '/assets/src-ai/'
rows = [('concept-blue.jpg', ['bF', 'bD', 'bL', 'bS']), ('concept-red.jpg', ['rF', 'rD', 'rL', 'rS']), ('red-flagship-ref.jpg', ['rF'])]
H = 420; out = []
for c, ids in rows:
    ci = Image.open(S + c).convert('RGB'); ci = ci.resize((int(ci.width * H / ci.height), H))
    ships = [Image.open(A + f'ship-{i}.png').convert('RGB').resize((H, H)) for i in ids]
    row = Image.new('RGB', (ci.width + H * len(ships) + 10 * len(ships), H), (12, 12, 18)); row.paste(ci, (0, 0))
    d = ImageDraw.Draw(row); d.text((8, 8), 'CONCEPT ' + c, fill=(255, 255, 0))
    for k, (sh, i) in enumerate(zip(ships, ids)):
        x = ci.width + 10 + k * (H + 10); row.paste(sh, (x, 0)); d.text((x + 8, 8), 'RENDER ' + i, fill=(255, 255, 0))
    out.append(row)
W = max(r.width for r in out); im = Image.new('RGB', (W, sum(r.height + 10 for r in out)), (12, 12, 18)); y = 0
for r in out: im.paste(r, (0, y)); y += r.height + 10
im.save(A + 'concept-vs-render.png'); print(A + 'concept-vs-render.png', im.size)
