// Capture a live app as stills for a film: Playwright at 2x to 4x, with the rects of the elements you name saved next to each still.
// usage: node capture.cjs <capture.json> [outDir]
// capture.json:
// { "url": "http://localhost:3000/", "device": "phone" | "laptop" | {"w":390,"h":844}, "dpr": 4, "browser": "chromium" | "webkit",
//   "storageState": "state.json" (optional, for a signed-in app), "hide": ["#intercom", ".cookie-banner"],
//   "steps": [ {"goto": "/pricing"}, {"click": "text=Accept"}, {"type": "Skellefteå", "into": "input[type=search]", "delay": 80},
//              {"scroll": 640} | {"scroll": "#features"}, {"wait": 600}, {"press": "Enter"}, {"eval": "document.body.classList.add('x')"},
//              {"shot": "list", "full": false, "rects": {"card": ".card:nth-child(2)", "cta": "button.buy"}} ] }
// Out: <name>.png per shot (viewport, or the whole page with "full": true), and rects.json (+ rects.js = window.RECTS for film pages):
//   { "<shot>": { "scrollY": 0, "viewport": [w, h], "dpr": 4, "rects": { "<key>": {x, y, w, h} } } }   rects in CSS px of the screen (page px for full shots)
// Rules: phone = 390 wide, laptop = 1280 or 1440 wide; never an in-between width to fit the frame. Never submit a payment or a booking on production.
const fs = require('fs'), path = require('path');
(async () => { const cfgPath = process.argv[2], cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')), out = process.argv[3] || path.join(path.dirname(cfgPath), 'img');
  fs.mkdirSync(out, { recursive: true });
  const vp = cfg.device === 'laptop' ? { width: 1440, height: 900 } : cfg.device && cfg.device.w ? { width: cfg.device.w, height: cfg.device.h } : { width: 390, height: 844 };
  const pw = require('playwright'), browser = await pw[cfg.browser || 'chromium'].launch();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: cfg.dpr || 4, isMobile: false, hasTouch: false, storageState: cfg.storageState, reducedMotion: 'no-preference' });
  const page = await ctx.newPage(); page.on('pageerror', e => console.log('pageerror:', e.message));
  const hide = async () => { if (cfg.hide && cfg.hide.length) await page.addStyleTag({ content: cfg.hide.join(',') + '{ visibility: hidden !important; }' }); };
  const abs = u => new URL(u, cfg.url).href;
  await page.goto(abs(cfg.url), { waitUntil: 'networkidle' }).catch(() => page.goto(abs(cfg.url))); await hide();
  const meta = fs.existsSync(path.join(out, 'rects.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'rects.json'), 'utf8')) : {};
  for (const s of cfg.steps || []) {
    if (s.goto) { await page.goto(abs(s.goto), { waitUntil: 'networkidle' }).catch(() => 0); await hide(); }
    else if (s.click) await page.click(s.click);
    else if (s.type != null) { if (s.into) await page.click(s.into); await page.keyboard.type(s.type, { delay: s.delay ?? 60 }); }
    else if (s.press) await page.keyboard.press(s.press);
    else if (s.scroll != null) await page.evaluate(y => typeof y === 'number' ? window.scrollTo(0, y) : document.querySelector(y).scrollIntoView(), s.scroll);
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.eval) await page.evaluate(s.eval);
    else if (s.shot) { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(s.settle ?? 400);
      const rects = {}; for (const [k, sel] of Object.entries(s.rects || {})) rects[k] = await page.evaluate(([sel, full]) => { const e = document.querySelector(sel); if (!e) return null;
        const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + (full ? scrollY : 0), w: r.width, h: r.height }; }, [sel, !!s.full]);
      const scrollY = await page.evaluate(() => scrollY);
      await page.screenshot({ path: path.join(out, s.shot + '.png'), fullPage: !!s.full });
      meta[s.shot] = { scrollY, viewport: [vp.width, vp.height], dpr: cfg.dpr || 4, full: !!s.full, rects };
      for (const [k, v] of Object.entries(rects)) if (!v) console.log(`  ${s.shot}: no element for "${k}"`);
      console.log('shot', s.shot); } }
  fs.writeFileSync(path.join(out, 'rects.json'), JSON.stringify(meta, null, 1));
  fs.writeFileSync(path.join(out, 'rects.js'), 'window.RECTS = ' + JSON.stringify(meta) + ';\n');
  await browser.close(); console.log('stills and rects.json in', out); })();
