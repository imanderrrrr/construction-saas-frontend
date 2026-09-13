# Demo recorder — the landing page's module clips

The clips in `public/demos/` are screen recordings of the **admin panel as it
ships**, driven by Playwright over a demo dataset. This folder is how they are
made, so the day a module is redesigned the footage can be replaced in minutes
instead of being quietly out of date on the marketing page.

## Re-record

```bash
npx playwright test --config=tools/demo-recorder/recorder.config.ts clips.rec.ts
node tools/demo-recorder/encode.mjs            # → public/demos/*.{webm,mp4,jpg} + manifest.json
node tools/demo-recorder/encode.mjs facturas   # just one clip
```

The config starts its own Vite server on `:5199` (`DEMO_PORT` to move it) and
reuses one that is already up. Nothing else is needed: **no backend** — every
`/api/v1/**` call is answered from `support/routes.ts`.

Review the result the way a reader sees it:

```bash
npx playwright test --config=tools/demo-recorder/recorder.config.ts landing.rec.ts
# → tools/demo-recorder/.shots/landing-*.png
```

## What is in here

| File | What it is |
|---|---|
| `clips.rec.ts` | One test per clip: the choreography, and the in/out points it wants kept. |
| `encode.mjs` | Cuts each raw recording to those points; writes VP9 `.webm`, H.264 `.mp4`, a `.jpg` poster and `manifest.json`. |
| `support/data.ts` | The demo company: five jobsites, their clients and crew. Invented — no real client, vendor or person appears in footage that ships on a public page. |
| `support/routes.ts` | The fixtures those screens are drawn from, registered over `e2e/support/mock-api.ts`. |
| `support/cursor.ts` | The pointer. Playwright's video does not draw the mouse, so without it the UI changes by itself and the clip reads as broken. |
| `support/stage.ts` | Signs in, forces Spanish, answers every section tour "already seen", and dresses the client-view link with the production host. |
| `support/clip.ts` | Writes the in/out points to `.out/clips/<key>.json`. |
| `landing.rec.ts` | Screenshots the finished block on the landing page. Review only. |

## Adding a clip

1. Add a test to `clips.rec.ts` (copy the nearest one; keep the beats slow —
   these loop silently at a third of a screen's width).
2. Add the file stem to the right group in
   `src/app/components/landing/DemoVideos.tsx`, and a title under
   `videos.<key>.title` in **both** `src/i18n/locales/{es,en}/landing.json`.
3. Add it to `GROUP` in `encode.mjs` so the manifest records where it belongs.
4. Record, encode, and update `CLIPS` in `src/app/pages/Landing.test.tsx`.

## Rules of the footage

- **The panel is the real one.** Only the data behind it is invented.
- **One dressing, documented in `support/stage.ts`:** the client-view link is
  drawn with `https://buildtrackfield.com` instead of the recorder's
  `localhost:5199`, so a dev URL never ships on a public page. The QR encodes
  the same link.
- **Nothing that is not built.** A clip shows a screen as it is, including the
  screens that have not been redesigned yet — which is why Cuentas por pagar
  and the bitácora are not in the set: they still wear the old chrome, and
  filming them next to the redesigned modules would advertise two products.
