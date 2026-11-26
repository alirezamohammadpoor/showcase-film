---
name: showcase-film
description: Make a short one-take product or feature film (black phone or laptop, rolling headlines, rows with a jumping square, line callouts, optional zoom) to showcase a project or product idea.
---

# Showcase film

Use this for short films that show off a product, a project or a new feature, made in the style of the TRY internship highlights reel.

## Get the kit
The kit (runtime, tools, a worked example and a README) lives in the public repo github.com/alirezamohammadpoor/showcase-film. Use the first of these that works:
1. `/mnt/project-files/showcase-film/`, if the session is in Ali's portfolio project.
2. `git clone https://github.com/alirezamohammadpoor/showcase-film "$SCRATCH/showcase-film"`.
3. On Ali's Mac: `~/Developer/showcase-film`.

Read its README.md first. Render from a scratch copy, never from a network mount. Node and Playwright with Chromium are needed (`npm i playwright` if missing), and ffmpeg for encoding.

## What a run makes
One run makes one feature film of 7 to 20 s (three to five beats). Films can be joined into a longer reel because the last frame of one film is the first frame of the next. Check each join with a pixel diff.

## The look (approved on the internship reel)
- One take with no cuts: screens morph, sheets rise and pages dissolve into the next. Use a flat ground.
- The device is a black phone (390 x 844 screen) or a black laptop window (1440 x 900).
- The frame is 4:5 (1080 x 1350, for LinkedIn) by default, or 16:9 (1920 x 1080, for the site or YouTube). It is rendered at 2x and 60 fps.
- Header: an overline (the product) and a headline that rolls per beat. Keep the headline to a few plain words.
- Rows: the beats as numbered rows on hairlines. A square jumps to the current row. Never mark a row "Done".
- Line callouts: a dot on the feature and a thin line out to a label on the ground, with one bend. Use no arrows.
  - Give the callout the feature and the still (`K.callout({ dev, feature, layer, text, sub })`). The kit routes the line itself through the emptiest space, so it covers as little content as possible.
  - Labels never cover the header, the rows, other labels or the device.
  - Check with `?routes=1`.
- Tap dot: a grey dot presses where a real tap happens.
- Zoom is NOT the default. Set it per beat:
  - `none`: the camera stays still.
  - `gentle`: a push of about 8% from the centre, with the whole device kept in frame.
  - `close`: a push to the feature that may crop the device. Use it only when a detail needs it, and set `focus` so the device clears the labels.
- Tempo: 44 to 76 frames of action per beat, with holds of 0.8 to 1.5 s on each result. Shorter is better.
- Copy: plain English about what the feature does. Use no dates and no metrics unless Ali gives them. Everything on screen must be real.

## Brand
Take the brand from the product, not from TRY and not from the portfolio:
1. Run `node tools/measure-brand.cjs <site url> <name>`. It writes `brands/<name>/brand.js`, fonts/ and measurements.json.
2. If there is no site, read the Figma variables (get_variable_defs) and write brand.js by hand.
3. If there is neither, use `brands/neutral`.

Show Ali the measured ground, ink, mute, line and accent, and get his OK before building. Fonts are for rendering only: never commit or publish them.

## Steps
1. Grill first, one decision card at a time, each with a recommended answer. Ask about:
   - which product and which features (3 to 5 beats);
   - phone or laptop;
   - 4:5 or 16:9;
   - the brand source;
   - where the zoom goes (per beat);
   - whether the film joins others.
2. Capture the screens. Use the live app first (localhost, preview or production) with `tools/capture.cjs` at 4x, saving the rects of every element that a callout, tap or zoom will use. Use Figma exports at 3x only for features that are not built yet.
   - Phone captures are 390 wide. Laptop captures are 1280 or 1440 wide. Never use an in-between width to make a page fit.
   - Hide chat bubbles and cookie banners.
   - Never submit a booking or a payment on production.
3. Write the beat sheet (template: `example/beats.md`) and send it to Ali.
4. Make the Figma storyboard:
   - Render each beat's key frame with `node tools/render.cjs stills <page> <outDir> f1,f2,... --png`.
   - Put the frames in one row on a dated Figma page, with the beat's notes as text under each frame.
   - Send the link. Do not animate until Ali has OK'd both the beat sheet and the storyboard.
5. Build the film page from `example/film.html`. Keep every frame number in one `T` table.
6. Check the stills, then run `node tools/render.cjs film <page> <framesDir> --jobs 4` and `bash tools/encode.sh <framesDir> <out.mp4>`.
7. Send the mp4 and its frame sheet. Keep each sent version's source as `vN-source/`. Ali gives feedback by voice: change what he names and keep the rest.

## Gotchas
- Never put `will-change` on the camera or the devices, or the frames blur.
- Capture at 4x for close zooms.
- A background command stops after 10 minutes. Use `--from/--to` slices for long films.
- A brand font that the machine lacks silently falls back to Inter, so check the stills.
- Film pages are standalone HTML. They do not go in any app repo.
