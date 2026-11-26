/* Showcase film kit. One film = one HTML page that draws any frame from scratch: window.seek(frame), window.FRAMES, 60 fps.
   Grown out of the internship reel (Nov 2026): one take, morphs instead of cuts, black devices, rolling labels, rows with a square
   that jumps to the current feature, plus elbow line callouts and camera zoom as a per-beat option (none by default).

   const K = Film({ frame: '4:5' | '16:9' })     reads window.BRAND (load a brands/<name>/brand.js before this file)
   Layers: K.world (#cam, moved by the camera) holds devices and tap dots; K.ui (#ui, frame pixels) holds labels, rows and callouts.
   Query: ?f=120 holds one frame, ?speed=0.25 slows playback, ?render=1 stops autoplay (the renderer adds it), ?frame=16:9, ?zoom=0 turns every zoom off. */
const FILM_SRC = document.currentScript ? document.currentScript.src : location.href;   // bezels/ sits next to kit/
function Film(opts = {}) {
  const q = new URLSearchParams(location.search);
  const FRAMES = { '4:5': { W: 1080, H: 1350, M: 72 }, '16:9': { W: 1920, H: 1080, M: 96 } };
  const FRAME = q.get('frame') || opts.frame || '4:5', { W, H, M } = FRAMES[FRAME];
  const GUT = 24, CW = (W - 2 * M - 11 * GUT) / 12;                                    // 12 columns
  const col = i => M + i * (CW + GUT), span = (a, b) => col(b) + CW - col(a);          // x of column i (0..11); width of columns a..b

  /* ---------- brand ---------- */
  const DEF = { name: 'neutral',
    colors: { ground: '#FFFFFF', panel: '#FFFFFF', ink: '#111111', mute: '#9C9C9C', line: '#E0E0E0', accent: '#111111', square: null, device: '#0B0B0C' },
    text: { family: 'Inter', weight: 400 }, head: { family: 'Inter Display', weight: 500, tracking: '-0.02em' },
    label: { family: 'Inter', weight: 600, case: 'uppercase', tracking: '0.02em' }, lineWidth: 2, fontFaces: [], base: '' };
  const BR = window.BRAND || {}, B = { ...DEF, ...BR, colors: { ...DEF.colors, ...(BR.colors || {}) }, text: { ...DEF.text, ...(BR.text || {}) },
    head: { ...DEF.head, ...(BR.head || {}) }, label: { ...DEF.label, ...(BR.label || {}) } };
  const C = B.colors; C.square = C.square || C.ink;
  if (B.fontFaces.length) { const st = document.createElement('style');
    st.textContent = B.fontFaces.map(f => `@font-face { font-family: "${f.family}"; src: url("${new URL(f.src, B.base || location.href).href}"); font-weight: ${f.weight || 400}; font-style: ${f.style || 'normal'}; }`).join('\n');
    document.head.appendChild(st); }
  const fam = f => `"${f}", Inter, sans-serif`;

  /* ---------- stage ---------- */
  const stage = document.getElementById('stage') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'stage' });
  Object.assign(stage.style, { width: W + 'px', height: H + 'px' });
  const vars = { '--ground': C.ground, '--panel': C.panel, '--ink': C.ink, '--mute': C.mute, '--line': C.line, '--accent': C.accent, '--square': C.square, '--device': C.device,
    '--text-font': fam(B.text.family), '--text-weight': B.text.weight, '--head-font': fam(B.head.family), '--head-weight': B.head.weight, '--head-tracking': B.head.tracking,
    '--label-font': fam(B.label.family), '--label-weight': B.label.weight, '--label-case': B.label.case, '--label-tracking': B.label.tracking };
  for (const k in vars) stage.style.setProperty(k, vars[k]);
  const el = (cls, css, html, into) => { const d = document.createElement('div'); d.className = cls || ''; Object.assign(d.style, css || {}); if (html != null) d.innerHTML = html; (into || stage).appendChild(d); return d; };
  const world = el('', { width: W + 'px', height: H + 'px' }); world.id = 'cam';
  const ui = el('', { width: W + 'px', height: H + 'px' }); ui.id = 'ui';
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); ui.appendChild(svg);

  /* ---------- curves (measured on the approved films) ---------- */
  function bezier(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return x => { x = Math.min(1, Math.max(0, x)); let t = x; for (let i = 0; i < 8; i++) { const f = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= f / d; } return ((ay * t + by) * t + cy) * t; }; }
  const camEase = bezier(0.33, 0.29, 0.18, 0.98), move = bezier(0.3, 0.2, 0.1, 1), enter = bezier(0.23, 1, 0.32, 1), leave = bezier(0.77, 0, 0.175, 1), out = bezier(0.16, 1, 0.3, 1);
  const house = (n, k = 0.84) => n <= 0 ? 0 : 1 - Math.pow(k, n);                       // UI settle: remaining distance x k per frame
  const clamp01 = v => Math.min(1, Math.max(0, v)), lerp = (a, b, p) => a + (b - a) * p;
  const prog = (F, a, b) => !isFinite(a) ? 0 : clamp01((F - a) / (b - a));
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const A = hex(a), Bc = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, Bc[i], p))).join(',')})`; };

  /* ---------- camera: still by default; zoom is an option per beat ---------- */
  const WIDE = { x: W / 2, y: H / 2, z: 1 }, moves = [], ZOOM = q.get('zoom') !== '0';
  let cam = WIDE;
  /* zoom(at, 'gentle' | 'close', { target, hold, dur, z })
     gentle: about 8% from the centre of the frame; the whole device stays in frame (the approved reel push).
     close:  (code look only; with Apple bezels it becomes gentle, the device is never cropped) pushes to target (a world rect, e.g. dev.rect(...)) so it fills about 60% of the frame width; the device may crop.
             focus: { x, y } puts the target's centre at that frame point instead of the centre, to keep a label column free.
     hold:   frames until it pulls back to wide (leave it out to stay until the next zoom). dur: frames per move (default 40, close 48). */
  function zoom(at, kind, o = {}) { if (!ZOOM || kind === 'none') return;
    if (kind === 'close' && LOOK === 'apple') { console.log('close zoom -> gentle: an Apple device stays whole in frame (Ali, Nov 26, and Apple\'s rules)'); kind = 'gentle'; } const t = o.target, dur = o.dur ?? (kind === 'close' ? 48 : 40); let to;
    if (kind === 'gentle') { const cy = t ? t.y + t.h / 2 : H / 2; to = { x: W / 2, y: H / 2 + Math.max(-14, Math.min(14, (cy - H / 2) * 0.25)), z: o.z ?? 1.08 }; }
    else { const z = o.z ?? Math.min(2.4, W * 0.6 / t.w, H * 0.45 / t.h), f = o.focus || { x: W / 2, y: H / 2 };     // focus: frame point where the target's centre lands
      to = { x: t.x + t.w / 2 - (f.x - W / 2) / z, y: t.y + t.h / 2 - (f.y - H / 2) / z, z }; }
    moves.push({ a: at, b: at + dur, to }); if (o.hold != null) moves.push({ a: at + o.hold, b: at + o.hold + dur, to: WIDE });
    moves.sort((m, n) => m.a - n.a); }
  function camera(F) { let c = WIDE; for (const m of moves) { if (F <= m.a) break; const p = camEase((F - m.a) / (m.b - m.a));
      c = { x: lerp(c.x, m.to.x, p), y: lerp(c.y, m.to.y, p), z: c.z * Math.pow(m.to.z / c.z, p) }; }
    cam = c; world.style.transform = `translate(${W / 2 - c.x * c.z}px,${H / 2 - c.y * c.z}px) scale(${c.z})`; }
  const toFrame = p => ({ x: W / 2 + (p.x - cam.x) * cam.z, y: H / 2 + (p.y - cam.y) * cam.z });

  /* ---------- devices ---------- */
  /* Two looks. 'apple' (default): Apple's official bezel PNG (Design Resources; fetch with tools/get-bezels.sh, never commit it) laid over the screen.
     'code': the black body drawn in CSS (12/14 px rim), the reel's look before Nov 26. ?bezel=code or Film({ bezel: 'code' }) picks it.
     Apple's art is used as is: no shadow, no tilt, no crop of the device. Phone captures for the Apple phone are 402 wide (iPhone 18 Pro, 402 x 874). */
  const SPECS = { phone: { sw: 390, sh: 844, rim: 12, sr: 62, br: 74 }, laptop: { sw: 1440, sh: 900, rim: 14, sr: 12, br: 24 } };
  const BEZELS = { phone: { src: 'iphone-18-pro-black.png', iw: 1350, ih: 2760, hx: 72, hy: 69, hw: 1206, hh: 2622, sw: 402, sr: 55, br: 62 },        // image px; hole = the screen
                   laptop: { src: 'macbook-pro-14-space-black.png', iw: 3860, ih: 2540, hx: 418, hy: 288, hw: 3024, hh: 1964, sw: 1440, sr: 10, br: 20 } };
  const LOOK = q.get('bezel') || opts.bezel || 'apple', BEZEL_DIR = opts.bezelDir || new URL('../bezels/', FILM_SRC).href;
  /* device('phone' | 'laptop', { x, y, h | w, screen: [w, h], bezel: 'apple' | 'code' }) in world px (world = frame when the camera is wide). */
  function device(kind, o = {}) { const look = o.bezel || LOOK, bz = look === 'apple' && BEZELS[kind];
    let sp, bw, bh, ox, oy;
    if (bz) { const k = bz.hw / bz.sw; sp = { sw: bz.sw, sh: Math.round(bz.hh / k), sr: bz.sr, br: bz.br }; bw = bz.iw / k; bh = bz.ih / k; ox = bz.hx / k; oy = bz.hy / k; }
    else { sp = { ...SPECS[kind] }; if (o.screen) [sp.sw, sp.sh] = o.screen; bw = sp.sw + 2 * sp.rim; bh = sp.sh + 2 * sp.rim; ox = oy = sp.rim; }
    const s = o.h ? o.h / bh : o.w ? o.w / bw : 1;
    const body = el('dev ' + kind + (bz ? ' apple' : ''), { left: '0px', top: '0px', width: bw + 'px', height: bh + 'px', borderRadius: (bz ? 0 : sp.br) + 'px', '--rim': (bz ? 0 : sp.rim) + 'px', '--sr': sp.sr + 'px' }, null, world);
    const screen = el('screen', { left: ox + 'px', top: oy + 'px', width: sp.sw + 'px', height: sp.sh + 'px', borderRadius: sp.sr + 'px' }, null, body);
    if (bz) { const img = document.createElement('img'); img.className = 'bezel'; Object.assign(img.style, { left: '0px', top: '0px', width: bw + 'px', height: bh + 'px' });
      img.onerror = () => { console.log(`missing bezel ${bz.src}: run tools/get-bezels.sh (drawing a plain black body instead)`); img.remove(); body.classList.remove('apple');
        Object.assign(body.style, { background: 'var(--device)', borderRadius: sp.br * 1.4 + 'px' }); };
      img.src = BEZEL_DIR + bz.src; body.appendChild(img); }
    const api = { body, screen, s, w: bw * s, h: bh * s, sw: sp.sw, sh: sp.sh, x: o.x ?? 0, y: o.y ?? 0, look: bz ? 'apple' : 'code',
      place(x, y, sc = api.s) { api.x = x; api.y = y; api.s = sc; body.style.transform = `translate(${x}px,${y}px) scale(${sc})`; },
      /* a still on the screen: full screen width, its own height (h); move it with translateY to scroll, fade with opacity */
      layer(src, lo = {}) { const d = el('layer', { width: sp.sw + 'px', height: (lo.h ?? sp.sh) + 'px', backgroundImage: `url("${src}")`, left: (lo.x ?? 0) + 'px', top: (lo.y ?? 0) + 'px' }, null, screen); if (lo.hidden) d.style.opacity = 0; return d; },
      /* screen px to world px, for callouts, taps and close zooms */
      point: (sx, sy) => ({ x: api.x + (ox + sx) * api.s, y: api.y + (oy + sy) * api.s }),
      rect: r => { const p = api.point(r.x, r.y); return { x: p.x, y: p.y, w: r.w * api.s, h: r.h * api.s }; } };
    api.place(api.x, api.y, s); return api; }

  /* ---------- labels ---------- */
  const IN = 54, OUT = 24, GAP = 4.2;
  /* one masked line that rolls: items = [[at, text], ...]; each rises in at its frame, the one before rolls out */
  function roll(cls, css, items, o = {}) { const end = o.end ?? Infinity, lines = items.map(([at, t]) => { const m = el('mask ' + cls, css, null, o.into || ui); m.innerHTML = `<span>${t}</span>`; return { at, s: m.firstChild, m }; });
    return F => lines.forEach((l, i) => { const next = lines[i + 1] ? lines[i + 1].at : end, a = l.at + (o.delay || 0), b = next + (o.delay || 0);
      const pin = enter(prog(F, a, a + IN)), pout = leave(prog(F, b - 12, b + OUT - 12)); l.s.style.transform = `translateY(${105 * (1 - pin) - 105 * pout}%)`;
      l.m.style.visibility = F < a || pout >= 1 ? 'hidden' : 'visible'; }); }
  /* header: overline, then a headline of one or two lines that changes per beat. heads = [[at, 'Line one\nLine two'], ...]; ctx = a smaller line under it */
  function header(o) { const x = (o.x ?? M) + 'px', y = o.y ?? 64, ups = [roll('over', { left: x, top: y + 'px' }, o.over || [], { end: o.end })];
    const n = Math.max(...o.heads.map(h => h[1].split('\n').length));
    for (let k = 0; k < n; k++) ups.push(roll('head', { left: x, top: y + 36 + k * 62 + 'px' }, o.heads.map(([at, t]) => [at, t.split('\n')[k] || '&nbsp;']), { delay: GAP * (k + 1), end: o.end }));
    if (o.ctx) ups.push(roll('ctx', { left: x, top: y + 110 + (n - 1) * 62 + 'px' }, o.ctx, { delay: GAP * (n + 1), end: o.end }));
    return F => ups.forEach(u => u(F)); }
  /* the film's beats as a numbered index top right: the current one ink, the others mute */
  function index(items, o = {}) { const at0 = o.at ?? 6, end = o.end ?? Infinity, rows = items.map(([at, t], i) => ({ at, r: el('idx', { right: (o.right ?? M) + 'px', top: (o.y ?? 64) + i * 30 + 'px' }, `<b>${String(i + 1).padStart(2, '0')}</b>${t}`, ui) }));
    return F => rows.forEach((x, i) => { const next = rows[i + 1] ? rows[i + 1].at : Infinity, a = at0 + i * 3, on = prog(F, x.at, x.at + 12) * (1 - prog(F, next, next + 12));
      x.r.style.color = mix(C.mute, C.ink, on); x.r.style.opacity = prog(F, a, a + 14) * (1 - prog(F, end - 12, end)); x.r.style.transform = `translateY(${8 * (1 - out(prog(F, a, a + 24)))}px)`; }); }
  /* rows on hairlines: mute until its beat, then ink with the square; the square jumps on to the next row (no "Done") */
  function rows(items, o) { const at0 = o.at ?? 10, size = o.size ?? 30, end = o.end ?? Infinity, list = items.map(([at, t], i) => { const r = el('row', { left: o.x + 'px', top: o.y + i * 60 + 'px', width: o.w + 'px' },
      `<i></i><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="t" style="font-size:${size}px;line-height:${size + 10}px;top:${Math.round((60 - size - 10) / 2) + 1}px">${t}</div><div class="q"></div>`, ui);
      return { at, r, i: r.children[0], n: r.children[1], t: r.children[2], q: r.children[3] }; });
    return F => list.forEach((x, k) => { const next = list[k + 1] ? list[k + 1].at : end, a = at0 + k * 3, on = prog(F, x.at, x.at + 12) * (1 - prog(F, next, next + 12) * (o.keep ? 0 : 1));
      x.r.style.opacity = prog(F, a, a + 14) * (1 - prog(F, end, end + 14)); x.r.style.transform = `translateY(${10 * (1 - out(prog(F, a, a + 28)))}px)`;
      x.i.style.background = F >= x.at ? C.ink : C.line; x.n.style.color = x.t.style.color = mix(C.mute, C.ink, o.keep ? prog(F, x.at, x.at + 12) : on);
      x.q.style.transform = `scale(${out(prog(F, x.at, x.at + 18)) * (1 - prog(F, next, next + 8))})`; }); }

  /* ---------- line callouts: a dot on the feature, a thin line out to the label, one bend, the label at its end ----------
     AUTO (use this): callout({ at, end, dev, feature, layer, scroll, side, text, sub })
       dev:     the device; feature: the feature's rect in screen px (rects.json); layer: the screen still under it (dev.layer(...)); scroll: its translateY (default 0)
       side:    'auto' (default), 'left' or 'right': which ground the label sits on
       The kit reads the still (pixels that differ from the screen's background colours, and edges) and tries every route:
         flat-then-bend  the dot on the feature's side edge, a flat line out of the device, the bend on the ground, the label hanging at the end;
         bend-then-flat  the dot on the feature's top or bottom edge, a short drop to the emptiest gap, then flat out of the device to the label.
       It keeps the route that crosses the least content, then the shortest; labels never cover the header, rows, index, other labels or the device.
       ?routes=1 prints each choice in the console and tints what the kit sees as content.
     MANUAL: callout({ at, end, point, to, text, sub }): point = world point on the feature, to = frame point where the line ends (flat, then one bend to to.y). */
  const busyMaps = new Map(), plans = [], placed = [], DEBUG = q.get('routes') === '1';
  async function busyMap(dev, layer, scroll) { const key = layer.style.backgroundImage + '|' + scroll; if (busyMaps.has(key)) return busyMaps.get(key);
    const img = new Image(); img.src = layer.style.backgroundImage.slice(5, -2); await img.decode();
    const w = dev.sw, h = dev.sh, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = C.panel; g.fillRect(0, 0, w, h); const k = w / img.naturalWidth; g.drawImage(img, parseFloat(layer.style.left) || 0, (parseFloat(layer.style.top) || 0) - scroll, w, img.naturalHeight * k);
    const px = g.getImageData(0, 0, w, h).data, lum = new Float32Array(w * h), hist = new Map();
    for (let i = 0; i < w * h; i++) { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]; lum[i] = 0.299 * r + 0.587 * gg + 0.114 * b; const q5 = (r >> 3) << 10 | (gg >> 3) << 5 | (b >> 3); hist.set(q5, (hist.get(q5) || 0) + 1); }
    const bgs = [...hist.entries()].sort((x, y) => y[1] - x[1]).filter(e => e[1] > w * h * 0.04).slice(0, 4).map(e => [(e[0] >> 10) << 3, (e[0] >> 5 & 31) << 3, (e[0] & 31) << 3]);
    const raw = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, gr = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]);
      const off = !bgs.some(c => Math.abs(px[i * 4] - c[0]) + Math.abs(px[i * 4 + 1] - c[1]) + Math.abs(px[i * 4 + 2] - c[2]) < 30); raw[i] = gr > 24 || off ? 1 : 0; }
    const busy = new Uint8Array(w * h), R = 4;                                                   // grown by 4 px: a line that passes closer than that reads as touching
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (raw[y * w + x]) for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; const r0 = yy * w; for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) busy[r0 + xx] = 1; } }
    const m = { w, h, at: (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= w || y >= h ? 0 : busy[y * w + x]; } };
    if (DEBUG) { const o = g.getImageData(0, 0, w, h); for (let i = 0; i < w * h; i++) if (busy[i]) { o.data[i * 4] = 255; o.data[i * 4 + 1] *= 0.6; o.data[i * 4 + 2] *= 0.6; } g.putImageData(o, 0, 0); m.tint = cv.toDataURL(); }
    busyMaps.set(key, m); return m; }
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function uiBoxes(at, end) { const boxes = []; for (const e of ui.querySelectorAll('.mask.over, .mask.head, .mask.ctx, .idx, .row')) { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const span = e.firstElementChild && e.classList.contains('mask') ? e.firstElementChild.getBoundingClientRect() : r;    // a rolled-out mask still has its width
      boxes.push({ x: r.x - s.x - 8, y: r.y - s.y - 8, w: Math.max(r.width, span.width) + 16, h: r.height + 16 }); }
    return boxes.concat(placed.filter(p => p.at < end + 30 && at < p.end + 30).map(p => p.box)); }
  async function plan(o, st) { const dev = o.dev, map = await busyMap(dev, o.layer, o.scroll || 0), f = o.feature, s = dev.s;
    /* the device in frame px over the callout's life (a zoom moves it), and the camera at the moment the line is drawn, for every other point */
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const last = Math.min(o.end ?? o.at + 240, o.at + 240);
    for (let F = o.at; F <= last; F += 4) { camera(F); for (const [cx, cy] of [[-dev.sw * 0.04, -dev.sh * 0.02], [dev.sw * 1.04, dev.sh * 1.02]]) { const c = toFrame(dev.point(cx, cy)); x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); } }
    const D = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; camera(o.at + 40); const fp = (a, b) => toFrame(dev.point(a, b));
    const box = st.box; box.style.display = ''; const lw = box.offsetWidth, lh = box.offsetHeight; const avoid = uiBoxes(o.at, o.end ?? Infinity).concat([{ x: D.x - 12, y: D.y - 12, w: D.w + 24, h: D.h + 24 }]);
    const inF = (x, y) => x > f.x - 2 && x < f.x + f.w + 2 && y > f.y - 2 && y < f.y + f.h + 2;
    const cost = (x0, y0, x1, y1) => { let n = 0; const L = Math.hypot(x1 - x0, y1 - y0); for (let t = 0; t <= L; t += 1) { const x = x0 + (x1 - x0) * t / (L || 1), y = y0 + (y1 - y0) * t / (L || 1); if (!inF(x, y)) n += map.at(x, y); } return n; };
    const sides = (o.side && o.side !== 'auto' ? [o.side] : ['left', 'right']).filter(sd => sd === 'left' ? D.x - M > lw + 40 : W - M - (D.x + D.w) > lw + 40);
    const ks = [0.5, 0.35, 0.65, 0.2, 0.8], ys = []; for (let y = M; y <= H - M; y += 8) ys.push(y);
    let best = null; const take = c => { if (!best || c.score < best.score) best = c; };
    for (const sd of sides) { const L = sd === 'left', colX = L ? D.x - 40 : D.x + D.w + 40, edgeX = L ? 0 : dev.sw;
      const labelBox = (tx, ty, mode) => mode === 'hang' ? { x: L ? tx - lw : tx, y: ty >= 0 ? ty : 0, w: lw, h: lh } : { x: L ? tx - 14 - lw : tx + 14, y: ty - lh / 2, w: lw, h: lh };
      const ok = b => b.x >= M - 4 && b.x + b.w <= W - M + 4 && b.y >= M - 20 && b.y + b.h <= H - M + 20 && !avoid.some(a => hits(a, b));
      /* flat-then-bend: dot on the side edge, flat out, bend on the ground, the label hangs at the end */
      for (const k of ks) { const ax = L ? f.x : f.x + f.w, ay = f.y + f.h * k, c0 = cost(ax, ay, edgeX, ay), P = fp(ax, ay);
        for (const ty of ys) { const down = ty >= P.y, b = down ? labelBox(colX, ty + 12, 'hang') : { ...labelBox(colX, 0, 'hang'), y: ty - 12 - lh }; if (!ok(b)) continue;
          take({ score: c0 * 10 + Math.abs(ty - P.y) * 0.04 + Math.abs(k - 0.5) * 6 + Math.abs(colX - P.x) * 0.01, route: 'flat', side: sd, a: [ax, ay], to: { x: colX, y: ty }, down, box: b, crossed: c0 }); } }
      /* bend-then-flat: dot on the top or bottom edge, a drop to the emptiest gap, flat out to the label */
      for (const k of ks) for (const dir of [-1, 1]) { const ax = f.x + f.w * k, ay = dir < 0 ? f.y : f.y + f.h;
        for (let gy = ay + dir * 10; gy > 4 && gy < dev.sh - 4 && Math.abs(gy - ay) < dev.sh * 0.45; gy += dir * 4) { const c1 = cost(ax, ay, ax, gy), c2 = cost(ax, gy, edgeX, gy);
          if (c1 > 30) break; const G = fp(ax, gy), b = labelBox(colX, G.y, 'mid'); if (!ok(b)) continue;
          take({ score: (c1 + c2) * 10 + Math.abs(gy - ay) * s * 0.04 + 3 + Math.abs(colX - G.x) * 0.01, route: 'bend', side: sd, a: [ax, ay], g: gy, to: { x: colX, y: G.y }, box: b, crossed: c1 + c2 }); } } }
    if (!best) { console.log('callout: no free place for the label of', o.text, '- set side, or make room'); best = { route: 'flat', side: 'left', a: [f.x, f.y + f.h / 2], to: { x: D.x - 40, y: fp(0, f.y).y + 60 }, down: true, box: { x: 0, y: 0, w: 0, h: 0 }, crossed: -1 }; }
    if (DEBUG) { console.log(`callout "${o.text}": ${best.route} ${best.side}, crosses ${best.crossed} px of content`); if (map.tint && !o.layer.dataset.tinted) { o.layer.style.backgroundImage = `url("${map.tint}")`; o.layer.style.backgroundSize = '100% 100%'; o.layer.dataset.tinted = 1; } }
    placed.push({ at: o.at, end: o.end ?? Infinity, box: best.box }); Object.assign(st, best); camera(0); }
  function callout(o) { const p = document.createElementNS(NS, 'path'), d = document.createElementNS(NS, 'circle'), u = document.createElementNS(NS, 'path');
    u.setAttribute('fill', 'none'); u.setAttribute('stroke', C.ground); u.setAttribute('stroke-width', B.lineWidth + 4); svg.appendChild(u);   // a casing in the ground colour, so the line still reads where it crosses the device
    d.setAttribute('stroke', C.ground); d.setAttribute('stroke-width', 2);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', C.ink); p.setAttribute('stroke-width', B.lineWidth); p.setAttribute('stroke-linejoin', 'miter');
    d.setAttribute('fill', C.ink); d.setAttribute('r', 6); svg.appendChild(p); svg.appendChild(d);
    const box = el('co', {}, null, ui), lines = [['t', o.text], ['s', o.sub]].filter(l => l[1]).map(([c, t]) => el('mask', {}, `<span class="${c}">${t}</span>`, box));
    const at = o.at, end = o.end ?? Infinity, DRAW = o.draw ?? 26, st = { box, route: 'manual' };
    if (o.feature) plans.push(() => plan(o, st));
    return F => { const show = F >= at - 1 && F < end + 30; p.style.display = u.style.display = d.style.display = box.style.display = show ? '' : 'none'; if (!show) return;
      let P, pts, T, mid = false, left, down;
      if (st.route === 'manual') { P = toFrame(typeof o.point === 'function' ? o.point(F) : o.point); T = o.to; left = T.x < P.x; down = T.y >= P.y; pts = [[P.x, P.y], [T.x, P.y]]; if (Math.abs(T.y - P.y) > 1) pts.push([T.x, T.y]); }
      else { P = toFrame(o.dev.point(...st.a)); left = st.side === 'left';
        if (st.route === 'flat') { T = st.to; down = st.down; pts = [[P.x, P.y], [T.x, P.y]]; if (Math.abs(T.y - P.y) > 1) pts.push([T.x, T.y]); }
        else { const G = toFrame(o.dev.point(st.a[0], st.g)); T = { x: st.to.x, y: G.y }; mid = true; pts = [[P.x, P.y], [G.x, G.y], [T.x, G.y]]; } }
      const len = pts.reduce((n, q, i) => i ? n + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0, 0);
      const k = move(prog(F, at + 6, at + 6 + DRAW)) * (1 - leave(prog(F, end + 4, end + 22)));
      p.setAttribute('d', 'M' + pts.map(q => q.map(v => v.toFixed(2)).join(' ')).join(' L')); p.setAttribute('stroke-dasharray', `${(len * k).toFixed(2)} ${len + 10}`);
      u.setAttribute('d', p.getAttribute('d')); u.setAttribute('stroke-dasharray', `${Math.max(0, len * k - 2).toFixed(2)} ${len + 10}`);
      d.setAttribute('cx', P.x); d.setAttribute('cy', P.y); d.setAttribute('r', 6 * out(prog(F, at, at + 14)) * (1 - prog(F, end + 16, end + 28)));
      if (mid) Object.assign(box.style, { left: left ? '' : T.x + 14 + 'px', right: left ? (W - T.x + 14) + 'px' : '', top: T.y - box.offsetHeight / 2 + 'px', bottom: '', textAlign: left ? 'right' : 'left' });
      else Object.assign(box.style, { left: left ? '' : T.x + 'px', right: left ? (W - T.x) + 'px' : '', top: down ? T.y + 12 + 'px' : '', bottom: down ? '' : (H - T.y + 12) + 'px', textAlign: left ? 'right' : 'left' });
      lines.forEach((m, i) => { const a = at + 6 + DRAW - 8 + i * 4, pin = enter(prog(F, a, a + IN)), pout = leave(prog(F, end - 2 + i * 3, end + OUT - 2 + i * 3));
        m.firstChild.style.transform = `translateY(${105 * (1 - pin) - 105 * pout}%)`; }); }; }

  /* ---------- tap dot, in the world so it follows the camera ---------- */
  function tap(at, point) { const t = el('tap', {}, null, world);
    return F => { const P = typeof point === 'function' ? point(F) : point, k = F - at; t.style.left = P.x + 'px'; t.style.top = P.y + 'px';
      t.style.opacity = prog(F, at - 10, at - 2) * (1 - prog(F, at + 6, at + 18)); t.style.transform = `scale(${k < 0 ? 1 : 1 - 0.18 * Math.sin(Math.min(1, k / 8) * Math.PI)})`; }; }

  /* ---------- go ---------- */
  function go(frames, update) { window.FRAMES = frames; let last = 0;
    window.seek = F => { last = F = Math.max(0, Math.min(frames - 1, F)); camera(F); update(F); };
    const decode = () => { const urls = [...new Set([...stage.querySelectorAll('.layer')].map(e => e.style.backgroundImage.slice(5, -2)))];
      return Promise.all([...urls.map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => console.log('missing still', u)); }), ...[...stage.querySelectorAll('img')].map(i => i.decode().catch(() => 0))]); };
    window.READY = document.fonts.ready.then(decode).then(() => document.fonts.ready).then(async () => { window.seek(0); for (const pl of plans) await pl(); window.seek(+(q.get('f') || last)); return true; });   // routes are planned in order, so later labels avoid earlier ones
    if (!q.has('render') && !q.has('f')) window.READY.then(() => { const t0 = performance.now(); (function tick(t) { window.seek(Math.floor((t - t0) / 1000 * 60 * (+(q.get('speed') || 1))) % frames); requestAnimationFrame(tick); })(t0); }); }

  return { q, B, C, W, H, M, CW, GUT, FRAME, col, span, stage, world, ui, el, bezier, camEase, move, enter, leave, out, house, clamp01, lerp, prog, mix,
    zoom, toFrame, device, roll, header, index, rows, callout, tap, go };
}
