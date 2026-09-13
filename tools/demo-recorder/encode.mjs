#!/usr/bin/env node
// Cut and encode the raw Playwright recordings into what the landing ships.
//
//   node tools/demo-recorder/encode.mjs [key|lang ...]
//
// Reads the in/out points each clip test wrote to .out/clips/<key>.<lang>.json
// and produces public/demos/<lang>/<key>.{webm,mp4,jpg}: VP9 for browsers that
// take it, H.264 (faststart) for the rest, and a poster for
// prefers-reduced-motion and for the first paint.
//
// One directory per language, because the landing page serves the clips of the
// language it is being read in.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CLIPS_DIR = 'tools/demo-recorder/.out/clips';
const OUT_DIR = 'public/demos';
const FPS = 25;
const SIZE = '1280:800';

// Which module block each clip belongs to on the landing page. Titles and
// captions are NOT here: they are i18n (`videos.*` in landing.json) so they
// can be translated — this file is the technical record of the footage.
const GROUP = {
  panel: 'panel',
  proyectos: '01-proyectos', contrato: '01-proyectos',
  presupuestos: '02-finanzas', facturas: '02-finanzas',
  pendientes: '03-bitacora-y-pendientes',
  consultas: '04-consultas-rfi',
  portal: 'portal-del-cliente',
};
const ORDER = Object.keys(GROUP);

const only = process.argv.slice(2);
const matches = (name) => {
  if (only.length === 0) return true;
  const [key, lang] = name.split('.');
  return only.includes(key) || only.includes(lang) || only.includes(name);
};
const files = fs.readdirSync(CLIPS_DIR).filter(f => f.endsWith('.json'))
  .filter(f => matches(path.basename(f, '.json')));

if (files.length === 0) {
  console.error(`No clip manifests in ${CLIPS_DIR}. Record first: npx playwright test --config=tools/demo-recorder/recorder.config.ts clips.rec.ts`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const encoded = [];

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const seconds = (ms) => (ms / 1000).toFixed(3);

for (const file of files.sort()) {
  const { key, lang, video, startMs, endMs } = JSON.parse(fs.readFileSync(path.join(CLIPS_DIR, file), 'utf8'));
  if (!video || !fs.existsSync(video)) {
    console.error(`✗ ${key}: raw recording missing (${video})`);
    process.exitCode = 1;
    continue;
  }
  const start = seconds(startMs);
  const dur = seconds(endMs - startMs);
  const vf = `fps=${FPS},scale=${SIZE}:flags=lanczos`;
  const dir = path.join(OUT_DIR, lang);
  fs.mkdirSync(dir, { recursive: true });
  const out = (ext) => path.join(dir, `${key}.${ext}`);

  ff(['-ss', start, '-i', video, '-t', dur, '-an', '-vf', vf,
      '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1',
      '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', out('webm')]);

  ff(['-ss', start, '-i', video, '-t', dur, '-an', '-vf', vf,
      '-c:v', 'libx264', '-crf', '25', '-preset', 'slow', '-profile:v', 'high',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out('mp4')]);

  // Poster: a beat in, so it is never the half-painted first frame.
  ff(['-ss', seconds(startMs + 1200), '-i', video, '-frames:v', '1',
      '-vf', `scale=${SIZE}:flags=lanczos`, '-q:v', '3', out('jpg')]);

  const kb = (ext) => Math.round(fs.statSync(out(ext)).size / 1024);
  console.log(`✓ ${lang}/${key.padEnd(14)} ${dur}s   webm ${kb('webm')} KB · mp4 ${kb('mp4')} KB · jpg ${kb('jpg')} KB`);
  encoded.push({ key, lang, durationSec: Number(dur) });
}

// The manifest is documentation: nothing imports it, and it exists so the next
// person knows what these files are and how to make them again.
if (only.length === 0) {
  const LANGS = [...new Set(encoded.map(c => c.lang))].sort();
  const manifest = {
    version: 3,
    recordedAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10),
    note:
      'Screen recordings of the BuildTrack admin panel as it ships, driven by Playwright over a demo dataset ' +
      '(tools/demo-recorder/). One set per language: the panel chrome AND the demo content are recorded in the ' +
      'language of the folder, so the landing page never shows a Spanish panel to an English reader. ' +
      '1280x800, silent, no narration and no editing beyond the cut. The data is invented — no real client, vendor ' +
      'or person appears; jobsite, client and people names are the same in both sets because proper nouns do not ' +
      'translate. The only dressing is the client-view link, drawn with the production host instead of the ' +
      'recorder\'s dev server (see tools/demo-recorder/support/stage.ts). ' +
      'Re-record: npx playwright test --config=tools/demo-recorder/recorder.config.ts clips.rec.ts && node tools/demo-recorder/encode.mjs',
    video: { width: 1280, height: 800, fps: FPS },
    playback: { autoplay: 'while on screen', loop: true, muted: true, playsInline: true },
    languages: LANGS,
    titles: 'src/i18n/locales/{es,en}/landing.json — videos.<key>.title',
    clips: ORDER.filter(k => encoded.some(c => c.key === k)).map(k => ({
      key: k,
      group: GROUP[k],
      byLanguage: Object.fromEntries(LANGS.map(l => {
        const c = encoded.find(x => x.key === k && x.lang === l);
        return [l, c && {
          durationSec: c.durationSec,
          poster: `/demos/${l}/${k}.jpg`,
          sources: [
            { src: `/demos/${l}/${k}.webm`, type: 'video/webm' },
            { src: `/demos/${l}/${k}.mp4`, type: 'video/mp4' },
          ],
        }];
      }).filter(([, v]) => v)),
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('✓ manifest.json');
}
