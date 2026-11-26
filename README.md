# Showcase film kit

Short product films in the style of the internship highlights reel (Nov 2026): one take, morphs instead of cuts, a black phone or laptop window,
a headline that rolls per beat, numbered rows with a square that jumps to the current feature, elbow line callouts, and camera zoom only where a
beat asks for it. Every film is one HTML page that draws any frame from scratch (`window.seek(frame)`, 60 fps), rendered with Playwright at 2x.

The skill that drives it is "showcase-film". This folder holds everything it runs.

## Folder
- `kit/film.js`, `kit/film.css`: the runtime. `const K = Film({ frame: '4:5' | '16:9' })`, then devices, labels, rows, callouts, taps, zoom, `K.go(frames, update)`. Read the comments at the top of each function.
- `brands/<name>/brand.js`: colours, fonts and tracking as `window.BRAND`. `neutral/` is the fallback. Fonts in `brands/*/fonts/` are for rendering only: never commit or publish them.
- `tools/measure-brand.cjs <url> <name>`: measures a product site into `brands/<name>/` (brand.js, fonts/, measurements.json). Its colours are guesses: confirm them.
- `tools/capture.cjs <capture.json> [outDir]`: captures the live app at 4x with the rects of named elements (`rects.json` + `rects.js`).
- `tools/render.cjs`: `film` (parallel ranges to r%04d.jpg at 2x), `stills` (beat stills for the storyboard and checks), `serve` (look at a page).
- `tools/encode.sh <framesDir> <out.mp4>`: x264 crf 19, faststart, plus a 32-tile frame sheet with frame numbers.
- `example/`: a worked film (Tempo, a made-up app): `app/`, `capture.json`, `img/`, `beats.md`, `film.html`, `tempo-example.mp4`.

## Run the example
```
cp -r /mnt/project-files/showcase-film "$SCRATCH/sf" && cd "$SCRATCH/sf"      # render from scratch: the mount is slow and noexec
node tools/render.cjs serve 8124 &                                              # the capture config points at this server
node tools/capture.cjs example/capture.json example/img
node tools/render.cjs stills example/film.html out/stills 100,200,380           # beat stills
node tools/render.cjs film example/film.html out/frames --jobs 4                # 450 frames, about 30 s
bash tools/encode.sh out/frames out/tempo.mp4
```
Page options: `?f=200` holds a frame, `?speed=0.25`, `?frame=16:9`, `?brand=<name>`, `?zoom=0` (all zooms off).

## Callouts route themselves
Give a callout the feature, not a path: `K.callout({ at, end, dev: phone, feature: R('add').field, layer: L.add, text, sub })` (`R(name)` = the rects from capture.cjs).
Before the first frame the kit reads the still under the feature (pixels that differ from the screen's background colours, plus edges, grown by 4 px)
and tries every route on both grounds:
- flat, then bend: the dot on the feature's side edge, a flat line out of the device, the bend on the ground, the label hanging at the end;
- bend, then flat: the dot on the feature's top or bottom edge, a short drop to the emptiest gap between rows, then flat out to the label.
It keeps the route that crosses the least content, then the shortest. Labels never cover the header, rows, index, an earlier label in the same
moment, or the device (including where a zoom moves it). `?routes=1` tints what it sees as content and logs each choice
(`node tools/render.cjs stills "page.html?routes=1" out 100`). `side: 'left' | 'right'` forces a ground; the manual form `{ point, to }` still works.

## Geometry
- 4:5 = 1080 x 1350, margin 72, 12 columns of 56 with 24 gutters. 16:9 = 1920 x 1080, margin 96, columns of 122. `K.col(i)`, `K.span(a, b)`.
- Phone screen 390 x 844 CSS px, 12 px black rim; laptop window 1440 x 900, 14 px rim. `device(kind, { x, y, h | w })` scales the whole device.
- `dev.point(sx, sy)` and `dev.rect({x, y, w, h})` turn screen px (as in rects.json) into world px for callouts, taps and zooms.
- World = frame while the camera is wide. Labels, rows and callouts live in frame px (`K.ui`), devices and taps in the world (`K.world`).

## Motion values (from the approved films)
- Beats 44 to 76 frames of action, holds of 0.8 to 1.5 s on a result; a section of 3 beats lands at about 7 to 13 s.
- Camera `bezier(0.33, 0.29, 0.18, 0.98)`, 40 frames (close 48). Gentle zoom = 1.08 about the centre, y within 14 px. Close zoom up to 2.4, usually 1.4 to 1.8.
- Label roll: in 54 frames on `bezier(0.23, 1, 0.32, 1)`, out 24 frames on `bezier(0.77, 0, 0.175, 1)`, lines 4 frames apart.
- UI settle: remaining distance x 0.82 to 0.84 per frame (`K.house(n, k)`). Callout: dot 14 frames, line draws 26, label rolls from the line's end.

## Gotchas
- No `will-change` on the camera layer or devices: Chromium then scales a 1x raster and everything blurs. Capture at 4x for any close zoom.
- Ink text or lines over a black device vanish. Keep the header, rows and label column on the ground: in a close zoom set `focus` (and a lower `z`) so the device clears them. Callout lines carry a ground-coloured casing for the part that crosses the device.
- Render from a scratch copy, never into /mnt/project-files (slow network mount; bun cannot exec there, node is fine; run .sh with bash).
- A background command stops after 10 minutes: `render.cjs film` splits into `--jobs` ranges; for long films render `--from/--to` slices.
- `render.cjs` launches Chromium with `--disable-checker-imaging` and waits for every still to decode, or big stills go missing from frames.
- A font that the brand names but the container lacks falls back to Inter silently: check the stills (measure-brand saves the site's web fonts; system fonts like Helvetica Neue are not saved).
