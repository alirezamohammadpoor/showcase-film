// Showcase film renderer. Serves a folder over http (so pages, brands and the kit load as they do in a browser) and screenshots #stage per frame.
// usage:
//   node render.cjs film   <page.html?query> <outDir> [--jobs 4] [--dpr 2] [--from 0] [--to FRAMES]   -> outDir/r0000.jpg ... (parallel ranges)
//   node render.cjs stills <page.html?query> <outDir> 0,120,240 [--dpr 1] [--png]                   -> outDir/f0120.jpg ... (storyboard stills, sheets)
//   node render.cjs serve  [port]                                                                    -> look at a film in the browser
// <page> is relative to --root (default: the showcase-film folder, i.e. this file's parent's parent). Copy the kit to a scratch folder for big renders:
// the project-files mount is slow for thousands of JPEGs, so write frames to scratch and copy only the mp4 back.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const argv = process.argv.slice(2), FL = {}, pos = [], BOOL = ['png'];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (!BOOL.includes(k) && i + 1 < argv.length) FL[k] = argv[++i]; else FL[k] = true; } else pos.push(a); }
const flag = (k, d) => FL[k] ?? d;
const ROOT = path.resolve(flag('root', path.join(__dirname, '..')));
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', cjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4' };
function server(port) { return new Promise(res => { const s = http.createServer((req, rsp) => { const u = new URL(req.url, 'http://x'), f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('no'); }
  rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(fs.readFileSync(f)); });
  s.listen(port || 0, '127.0.0.1', () => res(s)); }); }
async function open(pg, dpr) { const { chromium } = require('playwright'), s = await server(0), base = `http://127.0.0.1:${s.address().port}/`;
  const browser = await chromium.launch({ args: ['--disable-checker-imaging'] });   // or large stills can be missing from frames
  const page = await browser.newPage({ viewport: { width: 1920, height: 1920 }, deviceScaleFactor: dpr });
  page.on('pageerror', e => console.log('pageerror:', e.message)); page.on('console', m => { if (/missing|callout/.test(m.text())) console.log(m.text()); });
  await page.goto(base + pg + (pg.includes('?') ? '&' : '?') + 'render=1'); await page.evaluate(() => window.READY);
  return { page, stage: page.locator('#stage'), frames: await page.evaluate(() => window.FRAMES), close: async () => { await browser.close(); s.close(); } }; }
(async () => { const [mode, pg, out, list] = pos;
  if (mode === 'serve') { const s = await server(+(pg || 8123)); return console.log(`http://127.0.0.1:${s.address().port}/  (root ${ROOT})`); }
  if (mode === 'stills') { const r = await open(pg, +flag('dpr', 1)); fs.mkdirSync(out, { recursive: true }); const png = flag('png', false) === true;
    for (const n of list.split(',').map(Number)) { await r.page.evaluate(i => window.seek(i), n); await r.stage.screenshot({ path: path.join(out, `f${String(n).padStart(4, '0')}.${png ? 'png' : 'jpg'}`), ...(png ? {} : { type: 'jpeg', quality: 92 }) }); }
    console.log(r.frames, 'frames in the film; stills in', out); return r.close(); }
  if (mode === 'range') { const r = await open(pg, +flag('dpr', 2)); fs.mkdirSync(out, { recursive: true }); const a = +list, b = Math.min(r.frames, +flag('to', r.frames));
    for (let n = a; n < b; n++) { await r.page.evaluate(i => window.seek(i), n); await r.stage.screenshot({ path: path.join(out, `r${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 97 }); }
    console.log('range', a, b, 'done'); return r.close(); }
  if (mode === 'film') { const r = await open(pg, 1), frames = r.frames; await r.close(); const from = +flag('from', 0), to = Math.min(frames, +flag('to', frames)), jobs = +flag('jobs', 4), dpr = flag('dpr', 2);
    const step = Math.ceil((to - from) / jobs), t0 = Date.now(); console.log(pg, frames, 'frames; rendering', from, 'to', to, 'in', jobs, 'jobs at', dpr + 'x');
    await Promise.all([...Array(jobs)].map((_, j) => new Promise(res => { const a = from + j * step, b = Math.min(to, a + step); if (a >= b) return res();
      const c = spawn(process.execPath, [__filename, 'range', pg, out, String(a), '--to', String(b), '--dpr', String(dpr), '--root', ROOT], { stdio: 'inherit' }); c.on('exit', res); })));
    const miss = []; for (let n = from; n < to; n++) { const f = path.join(out, `r${String(n).padStart(4, '0')}.jpg`); if (!fs.existsSync(f) || fs.statSync(f).size < 1000) miss.push(n); }
    console.log(miss.length ? 'MISSING frames: ' + miss.join(',') : 'all frames present', '·', ((Date.now() - t0) / 1000).toFixed(0) + ' s'); return; }
  console.log('usage: node render.cjs film|stills|serve ...'); })();
