// Paint-splash engine: wobbly two-tone blobs + flying droplets.
// Used for the hero colour cycling, painting-series switches and the
// full-screen transition between sections.
import { seeded, easeOut, easeInOut, reducedMotion } from "./util.js";

const DPR = () => Math.min(2, window.devicePixelRatio || 1);
let splashCount = 0;

function makeSplash(x, y, w, h) {
  const rnd = seeded("splash" + splashCount++ + Math.random());
  const maxR = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  const waves = Array.from({ length: 4 }, () => ({ f: 2 + Math.floor(rnd() * 7), p: rnd() * 6.28, a: 0.02 + rnd() * 0.05 }));
  const arms = Array.from({ length: 6 + Math.floor(rnd() * 5) }, () => ({ a: rnd() * 6.28, amp: 0.15 + rnd() * 0.35, wid: 0.06 + rnd() * 0.12 }));
  const drops = Array.from({ length: 14 + Math.floor(rnd() * 10) }, () => ({
    a: rnd() * 6.28, k: 0.12 + rnd() * 0.7, s: 0.012 + rnd() * 0.04, j: (rnd() - 0.5) * 0.25,
  }));
  return { x, y, maxR, waves, arms, drops };
}

function blobPath(g, s, R, spikiness) {
  const N = 90;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 1;
    for (const w of s.waves) r += Math.sin(a * w.f + w.p) * w.a;
    for (const arm of s.arms) {
      let d = Math.abs(a - arm.a); d = Math.min(d, Math.PI * 2 - d);
      r += arm.amp * spikiness * Math.exp(-(d * d) / (arm.wid * arm.wid));
    }
    const px = s.x + Math.cos(a) * R * r, py = s.y + Math.sin(a) * R * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

function drawDrops(g, s, R, scale) {
  for (const d of s.drops) {
    const dist = R * (1.05 + d.k);
    const a = d.a + d.j * 0.3;
    const px = s.x + Math.cos(a) * dist, py = s.y + Math.sin(a) * dist;
    const r = s.maxR * d.s * scale;
    g.moveTo(px + r, py);
    g.arc(px, py, r, 0, Math.PI * 2);
    // little trailing smear back toward the blob
    const tx = s.x + Math.cos(a) * (dist - r * 3), ty = s.y + Math.sin(a) * (dist - r * 3);
    g.moveTo(tx + r * 0.5, ty);
    g.arc(tx, ty, r * 0.5, 0, Math.PI * 2);
  }
}

// Draws one splash at progress t (0..1).
function paintSplash(g, s, t, color, ink) {
  const e = easeOut(t);
  const R = e * s.maxR * 1.25;
  const spiky = 1 - e * 0.6;
  // ink leads, colour follows → the two-tone rim
  g.fillStyle = ink;
  blobPath(g, s, R * 1.06 + 6, spiky); g.fill();
  g.beginPath(); drawDrops(g, s, R * 1.06, 1 - e * 0.5); g.fill();
  g.fillStyle = color;
  blobPath(g, s, R, spiky); g.fill();
  g.beginPath(); drawDrops(g, s, R * 0.97, (1 - e * 0.5) * 0.7); g.fill();
}

/* A canvas that fills its parent and paints a solid colour that can
   "splash" to a new colour.                                            */
export class SplashBG {
  constructor(canvas, color, ink = "#0d0d0d") {
    this.c = canvas; this.g = canvas.getContext("2d");
    this.color = color; this.ink = ink; this.active = [];
    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(canvas.parentElement);
    this.resize();
  }
  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * DPR()); this.c.height = Math.round(r.height * DPR());
    this.draw();
  }
  to(color, x = this.w * Math.random(), y = this.h * Math.random(), dur = 900) {
    if (reducedMotion) { this.color = color; this.draw(); return; }
    this.active.push({ s: makeSplash(x, y, this.w, this.h), color, t0: performance.now(), dur });
    if (!this.raf) this.loop();
  }
  loop() {
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      const now = performance.now();
      // finished splashes become the new base colour
      while (this.active.length && now - this.active[0].t0 >= this.active[0].dur) this.color = this.active.shift().color;
      this.draw(now);
      if (this.active.length) this.loop();
    });
  }
  draw(now = performance.now()) {
    const g = this.g, d = DPR();
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = this.color; g.fillRect(0, 0, this.w, this.h);
    for (const a of this.active) paintSplash(g, a.s, Math.min(1, (now - a.t0) / a.dur), a.color, this.ink);
  }
}

/* Full-screen transition: splash covers the screen, `onCovered` runs
   (e.g. jump scroll), then a hole punches open to reveal the page.    */
let busy = false;
export async function splashTransition({ color, x, y, ink = "#0d0d0d", onCovered }) {
  if (reducedMotion || busy) { await onCovered?.(); return; }
  busy = true;
  const c = document.querySelector(".splash-overlay");
  const g = c.getContext("2d");
  const w = innerWidth, h = innerHeight, d = DPR();
  c.width = w * d; c.height = h * d; c.style.display = "block";
  g.setTransform(d, 0, 0, d, 0, 0);
  x ??= w / 2; y ??= h / 2;

  const run = (dur, frame) => new Promise((res) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      g.clearRect(0, 0, w, h); frame(t);
      t < 1 ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });

  const s1 = makeSplash(x, y, w, h);
  await run(620, (t) => paintSplash(g, s1, t, color, ink));
  await onCovered?.();
  await new Promise((r) => setTimeout(r, 90));
  const s2 = makeSplash(w / 2, h / 2, w, h);
  await run(560, (t) => {
    const e = easeInOut(t);
    const R = e * s2.maxR * 1.3;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = ink; blobPath(g, s2, R * 1.08 + 10, 1 - e * 0.5); g.fill();
    g.globalCompositeOperation = "destination-out";
    blobPath(g, s2, R, 1 - e * 0.5); g.fill();
    g.globalCompositeOperation = "source-over";
  });
  c.style.display = "none";
  busy = false;
}
