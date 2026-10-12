# Procedural Red hull paneling (fine plates + seams) -> assets/tex/red-panel-{normal,ao,rough}.webp
import numpy as np, random
from PIL import Image, ImageFilter
random.seed(7); N = 1024; G = 7
h = np.ones((N, N), np.float32); tone = np.zeros((N, N), np.float32)
def split(x, y, w, hh, d):
    if d > 4 or (d > 2 and random.random() < .3) or w < 70 or hh < 70:
        h[y:y + hh, x:x + G] = 0; h[y:y + G, x:x + w] = 0; tone[y + G:y + hh, x + G:x + w] = random.uniform(-.15, .15)
        if random.random() < .35 and w > 120 and hh > 120: ix, iy = x + w // 4, y + hh // 4; h[iy:iy + 4, ix:x + w - w // 4] = .3; h[iy:y + hh - hh // 4, ix:ix + 4] = .3
        return
    if w > hh * random.uniform(.7, 1.4): c = random.randint(int(w * .3), int(w * .7)); split(x, y, c, hh, d + 1); split(x + c, y, w - c, hh, d + 1)
    else: c = random.randint(int(hh * .3), int(hh * .7)); split(x, y, w, c, d + 1); split(x, y + c, w, hh - c, d + 1)
split(0, 0, N, N, 0)
hb = np.asarray(Image.fromarray((h * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255
gx = np.roll(hb, -1, 1) - np.roll(hb, 1, 1); gy = np.roll(hb, -1, 0) - np.roll(hb, 1, 0)
n = np.dstack([-gx * 4, gy * 4, np.ones_like(hb)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * .5 + .5) * 255).astype(np.uint8)).save('assets/tex/red-panel-normal.webp', quality=90)
Image.fromarray((np.clip(.2 + .8 * hb, 0, 1) * 255).astype(np.uint8)).save('assets/tex/red-panel-ao.webp', quality=90)
Image.fromarray((np.clip(.24 + tone * .7 + (1 - hb) * .35, .08, .75) * 255).astype(np.uint8)).save('assets/tex/red-panel-rough.webp', quality=90)
