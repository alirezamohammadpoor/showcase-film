// Measure a product's brand from its live site into brands/<name>/brand.js (+ fonts/ for rendering, + measurements.json).
// usage: node measure-brand.cjs <url> <name> [--width 1440]
// What it reads: font family, weight, size, line height, tracking and case of headings, body text and small capital labels; text and
// background colours by how much of the page they cover; @font-face files the page loads (saved to fonts/ FOR RENDERING ONLY: never commit
// or publish a licensed font). It guesses ground, ink, mute, line and accent: CONFIRM THEM WITH ALI before building (he checks that every
// colour exists in the product). For a product with only a Figma file, read its variables with the Figma MCP (get_variable_defs) and write brand.js by hand.
const fs = require('fs'), path = require('path');
(async () => { const [url, name] = process.argv.slice(2), wi = process.argv.indexOf('--width'), width = wi > 0 ? +process.argv[wi + 1] : 1440;
  const dir = path.join(__dirname, '..', 'brands', name), fdir = path.join(dir, 'fonts'); fs.mkdirSync(fdir, { recursive: true });
  const { chromium } = require('playwright'), browser = await chromium.launch(), page = await browser.newPage({ viewport: { width, height: 900 } });
  const fontFiles = new Map(); page.on('response', async r => { const u = r.url(); if (/\.(woff2?|ttf|otf)(\?|$)/i.test(u)) { try { fontFiles.set(u, await r.body()); } catch {} } });
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => 0); await page.waitForTimeout(1200);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  const m = await page.evaluate(() => {
    const st = e => { const s = getComputedStyle(e); return { family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: +s.fontWeight, size: parseFloat(s.fontSize), lh: s.lineHeight, tracking: s.letterSpacing, case: s.textTransform, color: s.color }; };
    const pick = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && e.innerText.trim()).slice(0, 6).map(e => ({ sel, text: e.innerText.trim().slice(0, 40), ...st(e) }));
    const caps = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.offsetParent && e.innerText.trim().length > 2 && getComputedStyle(e).textTransform === 'uppercase').slice(0, 6).map(e => ({ sel: 'caps', text: e.innerText.trim().slice(0, 40), ...st(e) }));
    const area = {}, ink = {}; for (const e of document.querySelectorAll('body, body *')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const s = getComputedStyle(e);
      if (s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) area[s.backgroundColor] = (area[s.backgroundColor] || 0) + r.width * r.height;
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) ink[s.color] = (ink[s.color] || 0) + n0(e); }
    function n0(e) { return [...e.childNodes].filter(n => n.nodeType === 3).reduce((k, n) => k + n.textContent.trim().length, 0); }
    const faces = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } for (const r of rules) if (r.type === 5) { const s = r.style;
      faces.push({ family: s.getPropertyValue('font-family').replace(/["']/g, '').trim(), weight: s.getPropertyValue('font-weight') || '400', style: s.getPropertyValue('font-style') || 'normal', src: s.getPropertyValue('src'), base: sh.href || location.href }); } }
    const vars = {}; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } for (const r of rules) if (r.style) for (const p of r.style) if (p.startsWith('--') && /color|colour|brand|accent|primary/i.test(p)) vars[p] = r.style.getPropertyValue(p).trim(); }
    return { title: document.title, h1: pick('h1'), h2: pick('h2'), h3: pick('h3'), body: pick('p'), buttons: pick('button, a[class*=button], a[class*=btn]'), caps, area, ink, faces, vars }; });
  await browser.close();
  const hex = c => { const v = (c.match(/[\d.]+/g) || []).map(Number); return '#' + v.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const sorted = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c: hex(c), n: Math.round(n) }));
  const bg = sorted(m.area), ink = sorted(m.ink), sat = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return Math.max(r, g, b) - Math.min(r, g, b); };
  const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000; };
  const ground = (bg[0] || { c: '#FFFFFF' }).c, inkC = (ink[0] || { c: '#111111' }).c;
  const mute = (ink.find(x => x.c !== inkC && sat(x.c) < 0.08 && Math.abs(lum(x.c) - lum(ground)) > 60) || { c: '#9C9C9C' }).c;
  const accent = ([...bg, ...ink].find(x => sat(x.c) > 0.25) || { c: inkC }).c;
  // fonts: save each file the page loaded that a @font-face rule names, as Family-weight[-italic].ext
  const fontFaces = []; for (const f of m.faces) { const u = (f.src.match(/url\(["']?([^"')]+)/) || [])[1]; if (!u) continue; const full = new URL(u, f.base).href, body = fontFiles.get(full); if (!body) continue;
    const ext = (full.match(/\.(woff2?|ttf|otf)/i) || ['', 'woff2'])[1], file = `${f.family.replace(/\s+/g, '')}-${f.weight.replace(/\s+/g, '_')}${f.style === 'italic' ? '-italic' : ''}.${ext}`;
    fs.writeFileSync(path.join(fdir, file), body); if (!fontFaces.some(x => x.src === 'fonts/' + file)) fontFaces.push({ family: f.family, weight: f.weight, style: f.style, src: 'fonts/' + file }); }
  const h = m.h1[0] || m.h2[0] || {}, t = m.body[0] || {}, l = m.caps[0] || {};
  const brand = { name, source: url, colors: { ground, panel: ground, ink: inkC, mute, line: '#E0E0E0', accent, square: inkC, device: '#0B0B0C' },
    text: { family: t.family || 'Inter', weight: t.weight || 400 }, head: { family: h.family || 'Inter Display', weight: h.weight || 500, tracking: h.tracking === 'normal' || !h.tracking ? '-0.02em' : h.tracking },
    label: { family: l.family || t.family || 'Inter', weight: l.weight || 600, case: 'uppercase', tracking: !l.tracking || l.tracking === 'normal' ? '0.02em' : l.tracking }, lineWidth: 2, fontFaces };
  fs.writeFileSync(path.join(dir, 'measurements.json'), JSON.stringify({ url, width, ...m, backgrounds: bg.slice(0, 12), textColors: ink.slice(0, 12) }, null, 1));
  fs.writeFileSync(path.join(dir, 'brand.js'), `/* ${name}: measured from ${url} at ${width} wide by tools/measure-brand.cjs. Guesses: check ground, ink, mute, line and accent with Ali. */\nwindow.BRAND = ${JSON.stringify(brand, null, 2)};\nwindow.BRAND.base = new URL('.', document.currentScript.src).href;\n`);
  console.log(JSON.stringify(brand.colors), '\nhead', brand.head.family, brand.head.weight, '· text', brand.text.family, '· label', brand.label.family, '·', fontFaces.length, 'font files'); console.log('wrote', dir); })();
