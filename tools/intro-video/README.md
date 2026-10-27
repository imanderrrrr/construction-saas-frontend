# Intro film — «Del plano a la obra» (ArchLogic → BuildTrack)

The brand intro that plays once, full screen, on a visitor's first desktop visit. It is a
[HyperFrames](https://hyperframes.heygen.com) composition (HTML + GSAP rendered frame by frame), so it
is edited as text and re-rendered the same every time.

ArchLogic is the *drawing*, BuildTrack is the *building*: the film goes from a drafting sheet to a
construction site, in the builder's own language (*obra*).

| | |
|---|---|
| Canvas | 2560 × 1080 (21:9), 60 fps, stereo sound, **9.15 s** |
| Ground | the landing's drawing paper `#F3EEE6` (`--color-bt-paper`); it fades to flat paper at the top and bottom edges, so a window taller than 21:9 shows no frame |
| Output | `public/intro/archlogic-buildtrack-intro.{mp4,webm}` (≈1.8 MB / ≈1.9 MB) |
| Played by | `src/app/components/IntroOverlay.tsx` (it must agree with this film on the paper colour and the length) |

Why 21:9: the camera pan leaves through the *window's* edge. On a 16:9 or 16:10 screen the video fills
the width, so nothing is clipped in the middle of the page.

## The film

| t (s) | What happens |
|---|---|
| 0 – 1.2 | The sheet: the grid unfolds from the centre, the ground line (*nivel 0.00*) is drawn, the sheet's labels and its datum (nivel ±0.00 · eje A-1) appear |
| 0.4 – 1.5 | The ArchLogic mark is **drafted**: outline, construction lines (the *A*'s sides meet above), dimension lines |
| 1.25 – 2.1 | The drawing turns solid: black base, then the orange *A* and *L* fill from the ground up |
| 1.75 – 3.5 | The mark cedes the centre; the name rises letter by letter from the ground line |
| 3.75 – 4.75 | **Whip-pan**: the camera sweeps along the sheet to the site (the world, the logos and the grid travel together, with velocity-matched blur) |
| 4.0 – 5.4 | The scaffold goes up (posts, ledgers, braces, couplers) and a **tower crane**; site tape is stretched across the foot |
| 4.95 – 6.2 | BuildTrack is laid course by course, bottom up, each course sliding in from alternating sides, like brickwork |
| 5.7 – 6.9 | The crane lifts the orange stroke on slings, swaying, and lowers it into the *A* of *Track* |
| 6.85 | **Contact**: flash, sparks and a small camera knock; the stroke stays — the brand's signature |
| 7.2 – 8.3 | The load leaves, the tape is cut and falls, the scaffold is taken down (drawn backwards) |
| 8.3 – 9.15 | Final hold on the finished BuildTrack, the crane still standing |

## The sound

Two layers, deliberately quiet — **−21.2 LUFS integrated, −5.7 dBFS peak** (it can start by itself when
a visitor arrives):

- **Effects** (`assets/sfx/`): real recordings, each with a cause on screen and its peak one frame after
  the picture — see the table in `assets/sfx/CREDITS.md`. Nothing is synthesised.
- **Music** (`assets/music/obra-bed.mp3`): a bed of synth pads with no drums; its swell crests as the
  crane sets the stroke. See `assets/music/CREDITS.md`.

> **Licence to check before relying on it commercially:** the construction effects and the music come
> from HeyGen's catalog; check HeyGen's terms for use outside its own videos. The rest of the effects
> are Pixabay (no attribution needed). To swap a file, keep its name and re-run `npm run render`.

On the site, browsers refuse to autoplay *with* sound on a first visit. `IntroOverlay` tries with sound
and, if refused, plays muted and shows one small "turn sound on" button.

Motion blur is explicit and deterministic: a horizontal SVG blur whose strength follows each move's
velocity curve (zero at rest). HyperFrames' render-time auto blur is off on purpose.

## Re-render

```bash
cd tools/intro-video
npm run dev                    # live preview in HyperFrames Studio
npm run check                  # lint + layout + timing validation
npm run render                 # → renders/ (needs ffmpeg)
INSTALL=1 npm run render       # …and copy the result to public/intro/
```

If you change the length, update `INTRO_VIDEO_DURATION_MS` in `IntroOverlay.tsx`. To watch it on the
site at any time, open any page with `?intro` (e.g. `https://buildtrackfield.com/?intro`) on a desktop
browser.

## How it is built

`index.html` holds the sheet (paper, grid, ground, labels) and the sound; `compositions/plano.html`
and `compositions/obra.html` are the two scenes. They are **generated** by `generator/build.cjs` from
`generator/glyphs.json` (the logos, vector-traced with potrace from the supplied PNGs, one piece per
letter) plus procedural geometry (crane, scaffold, hatch, tape). The generated HTML is the source of
truth and can be edited by hand — its timeline is at the bottom of each file — but anything structural
(positions, the crane, the sheet) is easier to change in `generator/build.cjs` and regenerate:

```bash
node generator/build.cjs       # rewrites index.html and compositions/
```

`assets/logos/*.svg` are the same traces as standalone vector logos on a transparent background, with
the brand colours sampled from the originals (orange gradient `#FE9D00 → #FC3F06` for the mark,
`#EF5701` BuildTrack, `#000` Track, `#030303` / `#373B3E` ArchLogic / Systems).

> `public/intro/buildtrack.png` is **not** part of this film: the backend uses it in transactional
> emails (password reset, invitations). Do not delete it.
