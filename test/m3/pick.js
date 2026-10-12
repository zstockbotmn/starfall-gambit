// 3D hit-test check: the square SGView.pick() raycasts for each of the tester's hit.js sample points vs the projected DOM square. Usage: node test/m3/pick.js http://127.0.0.1:8773/
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
const inQuad=(q,x,y)=>{let s=0;for(let k=0;k<4;k++){const[ax,ay]=q[k],[bx,by]=q[(k+1)%4];const c=(bx-ax)*(y-ay)-(by-ay)*(x-ax);if(c!==0){if(s&&Math.sign(c)!==s)return false;s=Math.sign(c);}}return true;};
const bil=(q,u,v)=>{const[a,b,c,d]=q;return[(a[0]*(1-u)+b[0]*u)*(1-v)+(d[0]*(1-u)+c[0]*u)*v,(a[1]*(1-u)+b[1]*u)*(1-v)+(d[1]*(1-u)+c[1]*u)*v];};
(async()=>{const b=await require(require('path').join(__dirname, '../../tools/guard.js')).launch(chromium, {executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [W,H] of [[390,844],[320,460]]){const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true,serviceWorkers:'block'});await ctx.addInitScript(()=>localStorage.setItem('sg_seen_rules','1'));
const p=await ctx.newPage();await p.goto(process.argv[2]+'?view=3d&nosw&tier=low&aidelay=60000');await p.waitForFunction(()=>window.SG3D&&SG3D.state!=='loading',null,{timeout:150000});await p.waitForTimeout(1500);
const cdp=await ctx.newCDPSession(p);const doc=await cdp.send('DOM.getDocument',{depth:0});const ids=(await cdp.send('DOM.querySelectorAll',{nodeId:doc.root.nodeId,selector:'#board .cell'})).nodeIds;
const Q=[];for(const id of ids){const a=(await cdp.send('DOM.getContentQuads',{nodeId:id})).quads[0];Q.push([[a[0],a[1]],[a[2],a[3]],[a[4],a[5]],[a[6],a[7]]]);}
const pts=[];const UV=[.04,.2,.5,.8,.96];for(let i=0;i<36;i++)for(const u of UV)for(const v of UV){if(u!==.5&&v!==.5&&!((u===.04||u===.96)&&(v===.04||v===.96)))continue;const[x,y]=bil(Q[i],u,v);pts.push([i,u,v,x,y,Q.findIndex(q=>inQuad(q,x,y))]);}
const got=await p.evaluate(P=>P.map(([i,u,v,x,y])=>SGView.pick(x,y,0)),pts);let mis=0,ex=[];pts.forEach((t,k)=>{if(got[k]!==t[5]){mis++;if(ex.length<5)ex.push([...t,got[k]]);}});
console.log(JSON.stringify({W,H,n:pts.length,mismatch:mis,ex}));await ctx.close();}await b.close();})();
