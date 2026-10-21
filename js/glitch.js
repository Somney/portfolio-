// Glitch overlay — DedSec-style bitmap collage that never repeats.
//
// Source images (always fresh):
//   • public-domain artworks from the Art Institute of Chicago open API
//   • random photos from Lorem Picsum
//   • your own artwork (TikTok covers / finished frames) — always works
// Each image is crushed into a two-tone "plate" (ordered dither, error-
// diffusion dither, halftone or posterized RGB split) in your palette.
// Plates are then sliced, repeated and flickered across a click-through
// overlay in short bursts, with a few pieces lingering as an edge collage.
// Settings: content.js → glitch. Off for prefers-reduced-motion.
import { reducedMotion } from "./util.js";

const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TEXT = ["//FURY.BLADE.SEIF", "SIGNAL::LOST", "ACCESS_GRANTED", "0x7F3A_9C21", "▓▒░ UPLOAD ░▒▓", "SKETCH.EXE", "//NO_SIGNAL",
  "REC ●", "PAINT.DLL", "> rerouting...", "ERR 0xDEAD", "▚▞▚▞▚▞", "CTRL+Z CTRL+Z", "dat.mosh", "//STATIC", "◢◤◢◤◢◤"];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function hex(c) { const n = parseInt(c.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/* ---------- image → two-tone bitmap plate ---------- */
function makePlate(img, palette, ink) {
  const w = Math.round(rnd(110, 210)), h = Math.max(24, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h), p = data.data;     // throws if the image isn't CORS-clean → caller skips it
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2]) / 255;
  // stretch contrast so every image punches
  let lo = 1, hi = 0; for (const v of lum) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < lum.length; i++) lum[i] = (lum[i] - lo) / Math.max(0.05, hi - lo);

  const A = hex(pick(palette)), B = hex(ink), mode = pick(["bayer", "bayer", "fs", "halftone", "rgb"]);
  const cutout = Math.random() < 0.78;                          // dark pixels go transparent → collage cut-out
  const set = (i, col, a = 255) => { p[i * 4] = col[0]; p[i * 4 + 1] = col[1]; p[i * 4 + 2] = col[2]; p[i * 4 + 3] = a; };

  if (mode === "bayer") {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, on = lum[i] > BAYER[(y & 3) * 4 + (x & 3)];
      on ? set(i, A) : cutout ? set(i, B, 0) : set(i, B);
    }
  } else if (mode === "fs") {
    const e = Float32Array.from(lum);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, on = e[i] > 0.5, err = e[i] - (on ? 1 : 0);
      if (x + 1 < w) e[i + 1] += (err * 7) / 16;
      if (y + 1 < h) { if (x) e[i + w - 1] += (err * 3) / 16; e[i + w] += (err * 5) / 16; if (x + 1 < w) e[i + w + 1] += err / 16; }
      on ? (cutout ? set(i, A, 0) : set(i, A)) : set(i, B);
    }
  } else if (mode === "rgb") {
    const C = hex(pick(palette)), o = Math.round(rnd(2, 5));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, l1 = lum[i], l2 = lum[y * w + Math.min(w - 1, x + o)];
      const q = Math.round(l1 * 2) / 2;                           // 3-level posterize
      if (l2 < 0.35 && l1 >= 0.35) set(i, C); else if (q === 0) set(i, B); else if (q === 0.5) set(i, A, cutout ? 0 : 255); else set(i, A, cutout ? 0 : 140);
    }
  }
  if (mode !== "halftone") { g.putImageData(data, 0, 0); return c; }
  // halftone: dot size from darkness
  g.clearRect(0, 0, w, h);
  if (!cutout) { g.fillStyle = `rgb(${A})`; g.fillRect(0, 0, w, h); }
  g.fillStyle = `rgb(${B})`;
  const cell = 4;
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const r = (1 - lum[Math.min(h - 1, y) * w + Math.min(w - 1, x)]) * cell * 0.62;
    if (r > 0.3) { g.beginPath(); g.arc(x + cell / 2, y + cell / 2, r, 0, 7); g.fill(); }
  }
  return c;
}

/* ---------- free image sources ---------- */
function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
    im.onload = () => res(im); im.onerror = rej; im.src = url;
    setTimeout(() => rej(new Error("timeout")), 12000);
  });
}
const SOURCES = {
  async artic() {   // Art Institute of Chicago — public-domain works
    const page = 1 + Math.floor(Math.random() * 90);
    const r = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=40&fields=image_id,is_public_domain`);
    const j = await r.json();
    const ok = (j.data || []).filter((a) => a.image_id && a.is_public_domain);
    const a = pick(ok); if (!a) throw new Error("none");
    return `https://www.artic.edu/iiif/2/${a.image_id}/full/400,/0/default.jpg`;
  },
  async picsum() { return `https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/360/260`; },
};

/* ---------- overlay ---------- */
export function initGlitch(cfg = {}, { palette, ink, local = [] }) {
  if (cfg.enabled === false || reducedMotion) return { burst() {} };
  const intensity = cfg.intensity ?? 1;
  const c = document.createElement("canvas"); c.className = "glitch-layer"; c.setAttribute("aria-hidden", "true");
  document.body.append(c);
  const g = c.getContext("2d");
  let W = 0, H = 0;
  const resize = () => { W = innerWidth; H = innerHeight; c.width = Math.round(W / 2); c.height = Math.round(H / 2); }; // half-res = chunky bitmap pixels
  addEventListener("resize", resize); resize();

  const root = document.documentElement;
  const plates = [];
  const MAX = 18;
  // never do image work mid-scroll or while the page is busy: wait for an idle moment
  const idle = () => new Promise((res) => {
    const go = () => (root.classList.contains("is-scrolling") ? setTimeout(go, 250)
      : (window.requestIdleCallback ? requestIdleCallback(() => res(), { timeout: 2000 }) : setTimeout(res, 60)));
    go();
  });
  async function addPlate(urlPromise) {
    try {
      const url = await urlPromise;
      const im = await loadImg(url);
      await im.decode?.().catch(() => {});      // decode off the main thread
      await idle();
      const pl = makePlate(im, palette, ink);
      plates.push(pl); if (plates.length > MAX) plates.splice(Math.floor(Math.random() * (plates.length - 4)), 1);
    } catch { /* blocked, offline or not CORS-clean — just skip it */ }
  }
  // seed: your own art first (same-origin, always works), then stock
  setTimeout(() => local.sort(() => Math.random() - 0.5).slice(0, 6).forEach((u, i) => setTimeout(() => addPlate(Promise.resolve(u)), i * 300)), 2500);
  const stock = cfg.stock !== false;
  const refill = () => {
    if (!stock) { if (local.length) addPlate(Promise.resolve(pick(local))); return; }
    const src = Math.random() < 0.6 ? SOURCES.artic : SOURCES.picsum;
    addPlate(src().catch(() => SOURCES.picsum()));
  };
  for (let i = 0; i < 6; i++) setTimeout(refill, 4000 + i * 900);
  setInterval(refill, (cfg.refreshSeconds ?? 20) * 1000);   // keep the visuals original

  /* pieces on screen */
  let pieces = [];
  const edgeX = () => (Math.random() < 0.5 ? rnd(-0.05, 0.16) : rnd(0.78, 0.98)) * (W / 2);

  function tile(life, edge) {
    if (!plates.length) return null;
    const narrow = W < 700, pl = pick(plates), s = narrow ? 1 : pick([1, 1, 1, 2]);
    // keep each piece small: at most ~30% of the screen wide (18% on phones)
    const maxW = (W / 2) * (narrow ? 0.18 : 0.3) / s, maxH = (H / 2) * 0.22 / s;
    const sw = Math.round(Math.min(pl.width * rnd(0.25, 0.7), maxW)), sh = Math.round(Math.min(pl.height * rnd(0.2, 0.6), maxH));
    const sx = Math.round(rnd(pl.width - sw)), sy = Math.round(rnd(pl.height - sh));
    const reps = Math.random() < 0.55 ? Math.floor(rnd(2, narrow ? 3 : 5)) : 1, vertical = Math.random() < 0.35;
    return { kind: "tile", pl, sx, sy, sw, sh, s, reps, vertical, step: rnd(0.25, 1.05),
      x: edge ? edgeX() : rnd(-0.1, 0.9) * (W / 2), y: rnd(-0.05, 0.9) * (H / 2), t0: performance.now(), life, edge };
  }
  function textStrip(life) {
    return { kind: "text", str: pick(TEXT), reps: Math.floor(rnd(1, 4)), col: pick(palette), inv: Math.random() < 0.5,
      x: rnd(0, 0.85) * (W / 2), y: rnd(0.02, 0.95) * (H / 2), t0: performance.now(), life };
  }
  function bars(life) {
    return { kind: "bars", n: Math.floor(rnd(2, 6)), col: pick(palette), y: rnd(H / 2), t0: performance.now(), life };
  }

  function burst(strength = 1) {
    const n = Math.round((1.5 + rnd(2.5)) * strength * intensity * (W < 700 ? 0.6 : 1));
    for (let i = 0; i < n; i++) { const t = tile(rnd(160, 650) * Math.min(1.6, strength)); t && pieces.push(t); }
    if (Math.random() < 0.8) pieces.push(textStrip(rnd(300, 900)));
    if (Math.random() < 0.6) pieces.push(bars(rnd(120, 380)));
    // a lingering collage piece at the edges
    if (pieces.filter((p) => p.edge).length < (W < 700 ? 1 : 2 + intensity) && Math.random() < 0.6) { const t = tile(rnd(5000, 11000), true); t && pieces.push(t); }
    kick();
  }

  function drawTile(p, now) {
    const { pl, sx, sy, sw, sh, s } = p;
    const jitter = Math.random() < 0.2 ? rnd(-6, 6) : 0;
    for (let r = 0; r < p.reps; r++) {
      const ox = p.vertical ? 0 : r * sw * s * p.step, oy = p.vertical ? r * sh * s * p.step : 0;
      // horizontal slice displacement
      const slices = Math.random() < 0.5 ? 1 : Math.floor(rnd(2, 6));
      const bh = Math.ceil(sh / slices);
      for (let k = 0; k < slices; k++) {
        const shift = slices > 1 && Math.random() < 0.6 ? rnd(-14, 14) : 0;
        const yy = sy + k * bh, hh = Math.min(bh, sy + sh - yy);
        if (hh <= 0) continue;
        g.drawImage(pl, sx, yy, sw, hh, p.x + ox + shift + jitter, p.y + oy + k * bh * s, sw * s, hh * s);
      }
    }
  }

  let raf = 0, last = 0;
  function kick() { c.style.display = ""; if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (root.classList.contains("is-scrolling")) { kick(); return; }   // paused while scrolling (layer is hidden)
    if (now - last < 45) { kick(); return; }                     // ~22 fps: steppy, like a broken screen
    last = now;
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    pieces = pieces.filter((p) => now - p.t0 < p.life);
    for (const p of pieces) {
      const age = (now - p.t0) / p.life;
      if (Math.random() < (p.edge ? 0.08 : 0.18)) continue;       // flicker
      g.globalAlpha = p.edge ? Math.min(1, age * 8, (1 - age) * 6) * 0.7 : 0.9;
      if (p.kind === "tile") drawTile(p, now);
      else if (p.kind === "text") {
        g.font = "700 8px ui-monospace, Menlo, monospace"; g.textBaseline = "top";
        const tw = g.measureText(p.str).width + 6;
        for (let r = 0; r < p.reps; r++) {
          const x = p.x + rnd(-2, 2), y = p.y + r * 11;
          g.fillStyle = p.inv ? p.col : ink; g.fillRect(x, y, tw, 10);
          g.fillStyle = p.inv ? ink : p.col; g.fillText(p.str, x + 3, y + 1.5);
        }
      } else if (p.kind === "bars") {
        g.fillStyle = p.col;
        for (let i = 0; i < p.n; i++) g.fillRect(0, (p.y + i * rnd(3, 14) + rnd(-4, 4)) % (H / 2), W / 2, rnd(1, 3));
        g.fillStyle = ink;
        for (let i = 0; i < 18; i++) g.fillRect(rnd(W / 2), p.y + rnd(-20, 20), rnd(2, 10), rnd(1, 4));   // noise blocks
      }
    }
    g.globalAlpha = 1;
    // nothing on screen → take the layer out of compositing entirely
    c.style.display = pieces.length ? "" : "none";
    if (pieces.length) kick();
  }

  // ambient bursts every few seconds while the page is visible
  (function loop() {
    setTimeout(() => { if (!document.hidden && !root.classList.contains("is-scrolling")) burst(0.8 + rnd(0.6)); loop(); }, rnd(2600, 6500) / Math.max(0.3, intensity));
  })();

  // glitch headings now and then
  const heads = [...document.querySelectorAll(".sec-title, .hero__name, .contact__big")];
  heads.forEach((h) => (h.dataset.text = h.textContent));
  setInterval(() => {
    const h = pick(heads); if (!h) return;
    h.dataset.text = h.textContent; h.classList.add("glitching");
    setTimeout(() => h.classList.remove("glitching"), rnd(250, 600));
  }, 2200);

  return { burst };
}
