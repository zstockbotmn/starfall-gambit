# AI hull textures (Grok Imagine, assets/src-ai/*-hull.jpg) -> seamless square webp base-colour + emissive maps in assets/tex/.
# 16:9 -> centre square crop -> seamless (half-offset + feathered cross blend with the original) -> 512 px webp; emissive = neon pixels only.
import numpy as np
from PIL import Image, ImageFilter
import os
os.makedirs('assets/tex', exist_ok=True)
def seamless(a):
    n = a.shape[0]; r = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    x = np.abs(np.arange(n) - n / 2) / (n / 2)                # 0 at centre, 1 at edges
    w = np.clip((np.maximum.outer(x, x) - .55) / .4, 0, 1)    # rolled image near its own edges? no: original edges sit at rolled centre
    m = 1 - np.clip((1 - np.minimum.outer(x, x)) * 0, 0, 1)
    # rolled image is seamless at the borders but has the old seams through its centre cross; cover that cross with the (unrolled) original
    cross = np.clip(1 - np.minimum.outer(x, x) / .12, 0, 1)   # 1 on the centre lines
    cross = np.array(Image.fromarray((cross * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(n / 40))) / 255.
    return (r * (1 - cross[..., None]) + a * cross[..., None]).astype(np.uint8)
out = {}
for side, f in [('red', 'red-hull.jpg'), ('blue', 'blue-hull.jpg')]:
    im = Image.open('assets/src-ai/' + f).convert('RGB'); W, H = im.size; s = min(W, H)
    sq = np.array(im.crop(((W - s) // 2, (H - s) // 2, (W + s) // 2, (H + s) // 2)))
    t = Image.fromarray(seamless(sq)).resize((512, 512), Image.LANCZOS)
    a = np.asarray(t).astype(float) / 255; mx, mn = a.max(2), a.min(2); sat = (mx - mn) / (mx + 1e-6)
    neon = (sat > (.3 if side == 'red' else .35)) & (mx > (.28 if side == 'red' else .35))
    if side == 'blue': neon &= (a[..., 1] > a[..., 0] + .08)   # teal light strips only (not the gold inlay)
    e = (a * neon[..., None] * 255).astype(np.uint8)
    t.save(f'assets/tex/{side}-hull.webp', quality=82); Image.fromarray(e).filter(ImageFilter.GaussianBlur(.6)).save(f'assets/tex/{side}-hull-emissive.webp', quality=80)
    # tiling proof: 2x2
    tt = Image.new('RGB', (1024, 1024)); [tt.paste(t, (x, y)) for x in (0, 512) for y in (0, 512)]; tt.save(f'screenshots/m3/assets/{side}-hull-tiled-2x2.png')
    out[side] = {k: os.path.getsize(f'assets/tex/{side}-hull{k}.webp') for k in ('', '-emissive')}
print(out)
