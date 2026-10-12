import json, numpy as np
from PIL import Image
D='/workspace/sg-tools/ct21'; M=json.load(open(D+'/meta.json')); geo=M['geo']; dpr=M['dpr']
# M2.1 nominal marker colours (capture brackets are #ff4f8b on Blue ships)
NOM={'move':'#5cffc8','foering':'#ff8fe0','lane':'#ffe680','cap':'#ffffff','threat':'#e5452e','bang':'#ffffff','last':'#ffd65a','sel':'#5cffc8','selfoe':'#ff9de6','forecast':'#c08cff','dangerRing':'#ff4d4d'}
def hx(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
def lum(a):
    a=a/255.0; a=np.where(a<=0.03928,a/12.92,((a+0.055)/1.055)**2.4); return 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
def cr(a,b):
    la,lb=lum(a),lum(b); hi=np.maximum(la,lb); lo=np.minimum(la,lb); return (hi+0.05)/(lo+0.05)
def sqtype(i):
    r,c=divmod(i,6); return ('Red' if i<18 else 'Blue')+(' alt' if (r+c)%2 else '')
rows=[]
for pn,P in M['passes'].items():
    for m in P['mk']:
        A=np.asarray(Image.open(f'{D}/{pn}-{m}-A.png').convert('RGB'),float); B=np.asarray(Image.open(f'{D}/{pn}-{m}-B.png').convert('RGB'),float)
        for half in ['Red','Blue']:
            res=[]; strict=[]
            for i,(x,y,w,h) in enumerate(geo):
                if not sqtype(i).startswith(half): continue
                x0,y0,x1,y1=[int(round(v*dpr)) for v in (x+1,y+1,x+w-1,y+h-1)]
                a=A[y0:y1,x0:x1]; b=B[y0:y1,x0:x1]
                ch=np.abs(a-b).sum(-1)>45
                if m=='SHIP': core=ch & (lum(a)>0.0)   # all changed ship pixels
                else:
                    n=hx('#ff4f8b' if (m=='cap' and pn.startswith('blueShips')) else NOM[m]); core=ch & (np.linalg.norm(a-n,axis=-1)<np.linalg.norm(a,axis=-1))
                if m!='SHIP': strict.append(cr(a[core & (np.linalg.norm(a-n,axis=-1)<90)],b[core & (np.linalg.norm(a-n,axis=-1)<90)]))
                if core.sum()<4: continue
                res.append(cr(a[core],b[core]))
            if not res: continue
            v=np.concatenate(res); sv=np.concatenate(strict) if strict else np.array([]); sp=np.percentile(sv,10) if sv.size>20 else float('nan'); rows.append((pn,m,half,len(v),np.percentile(v,10),np.median(v),sp))
print(f"{'pass':18}{'marker':11}{'half':6}{'px':>7}{'p10':>7}{'median':>8}{'p10near':>9}")
for r in rows:
    flag='  <3' if r[5]<3 else ('  (p10<3)' if r[4]<3 else '')
    print(f"{r[0]:18}{r[1]:11}{r[2]:6}{r[3]:7d}{r[4]:7.2f}{r[5]:8.2f}{r[6]:9.2f}{flag}")
json.dump([dict(zip(['pass','marker','half','px','p10','median','p10_near_nominal'],[*r[:3],int(r[3]),float(r[4]),float(r[5]),float(r[6])])) for r in rows],open('/workspace/sg-tools/contrast_results21.json','w'),indent=1)
