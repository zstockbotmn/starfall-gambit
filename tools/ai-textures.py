# AI images (Grok Imagine, assets/src-ai/) -> runtime textures in assets/tex/.
# Hull panels: the source images are already periodic (2x2 repeats), so we find the exact period by autocorrelation and
# crop ONE period: seamless by construction (no blending -> no double lines). 512x512 webp + emissive (neon pixels only).
# Red flagship top reference -> 'redSkin' planar texture on Red hull tops; hologram 4x4 sheet -> additive hologram atlas.
import numpy as np, os, json
from PIL import Image, ImageFilter
os.makedirs('assets/tex', exist_ok=True); info = {}
def period(a, lo_x=200, lo_y=150):
    g = a.mean(2); g = g - g.mean(); F = np.fft.fft2(g); ac = np.real(np.fft.ifft2(F * np.conj(F))); H, W = g.shape
    return int(np.argmax(ac[0, lo_x:W - 100]) + lo_x), int(np.argmax(ac[lo_y:H - 100, 0]) + lo_y)
def emissive(a, side):
    mx, mn = a.max(2), a.min(2); sat = (mx - mn) / (mx + 1e-6)
    neon = (sat > (.3 if side != 'blue' else .35)) & (mx > (.28 if side != 'blue' else .35))
    if side == 'blue': neon &= (a[..., 1] > a[..., 0] + .08)
    return Image.fromarray((a * neon[..., None] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))
for side in ['blue', 'red']:
    im = np.asarray(Image.open(f'assets/src-ai/{side}-hull.jpg').convert('RGB')); px, py = period(im)
    tile = Image.fromarray(im[:py, :px]).resize((512, 512), Image.LANCZOS); a = np.asarray(tile).astype(float) / 255
    tile.save(f'assets/tex/{side}-hull.webp', quality=82); emissive(a, side).save(f'assets/tex/{side}-hull-emissive.webp', quality=80)
    th = int(512 * py / px); tt = Image.new('RGB', (1024, th * 2)); [tt.paste(tile.resize((512, th)), (x, y)) for x in (0, 512) for y in (0, th)]
    tt.save(f'screenshots/m3/assets/{side}-hull-tiled-2x2.png'); info[side] = {'period': [px, py], 'aspect': py / px}
ref = Image.open('assets/src-ai/red-flagship-ref.jpg').convert('RGB'); W, H = ref.size
top = ref.crop((int(.02 * W), int(.41 * H), int(.98 * W), int(.92 * H))).resize((1024, 512), Image.LANCZOS)
top.save('assets/tex/red-skin-top.webp', quality=80); emissive(np.asarray(top).astype(float) / 255, 'red').save('assets/tex/red-skin-top-emissive.webp', quality=80)
ho = Image.open('assets/src-ai/red-holo-sprites.jpg').convert('RGB').resize((1024, 576), Image.LANCZOS); ho.save('assets/tex/holo-atlas.webp', quality=82)
json.dump(info, open('assets/tex/tex-info.json', 'w')); print(info, {f: os.path.getsize('assets/tex/' + f) for f in os.listdir('assets/tex')})
