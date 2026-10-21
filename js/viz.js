// Signal bars behind the dancer: chunky LCD meter columns, dithered in ink.
//  • real levels from the site's audio analyser (site sounds + uploaded music)
//  • YouTube audio can't be read by a web page, so while it plays the bars
//    run a beat-shaped pattern instead
//  • a low idle flicker when nothing is playing
import { reducedMotion } from "./util.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const COLS = 15, CELL = 4, GAP = 1;             // bars × low-res pixels per bar
const BPM = 112;

export function startViz(canvas, { ink = "#0d0d0d", state = () => ({}) } = {}) {
  const g = canvas.getContext("2d");
  const W = COLS * (CELL + GAP), H = Math.round(W * 150 / 160);   // same shape as the sprite box → square pixels
  canvas.width = W; canvas.height = H;
  let floor = 0.96, visible = true, raf = 0, last = 0, scrolling = 0;
  const lvl = new Float32Array(COLS), peak = new Float32Array(COLS), peakHold = new Float32Array(COLS);
  let freq = null;
  const rgb = (() => { const n = parseInt(ink.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })();
  const img = g.createImageData(W, H);

  addEventListener("scroll", () => (scrolling = performance.now()), { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas.parentElement);

  // read target levels (0..1) for each bar
  function targets(t) {
    const { analyser, playing } = state();
    const out = new Float32Array(COLS);
    let energy = 0;
    if (analyser) {
      freq ??= new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      const n = freq.length;
      for (let i = 0; i < COLS; i++) {                                   // log-spaced bands, lows on the left
        const a = Math.floor(Math.pow(n, i / COLS)) - 1, b = Math.max(a + 1, Math.floor(Math.pow(n, (i + 1) / COLS)) - 1);
        let m = 0; for (let k = Math.max(0, a); k < Math.min(n, b + 1); k++) m = Math.max(m, freq[k]);
        out[i] = Math.pow(m / 255, 1.3) * (0.75 + 0.35 * (i / COLS));
        energy += out[i];
      }
    }
    if (energy > 0.25) return out;                                      // real sound is playing
    if (playing) {                                                      // YouTube: beat-shaped stand-in
      const beat = t * BPM / 60, f = beat % 1, kickE = Math.exp(-f * 6), off = Math.exp(-((beat + 0.5) % 1) * 8);
      for (let i = 0; i < COLS; i++) {
        const x = i / (COLS - 1);
        const shape = 0.85 - 0.45 * x;                                  // more low end
        const wob = 0.5 + 0.5 * Math.sin(t * (2.2 + i * 0.7) + i * 1.9);
        out[i] = Math.min(1, shape * (0.25 + 0.6 * kickE * (1 - x * 0.6)) + 0.25 * off * x + 0.22 * wob * Math.random());
      }
      return out;
    }
    for (let i = 0; i < COLS; i++) out[i] = 0.05 + 0.06 * Math.random() * (0.5 + 0.5 * Math.sin(t * 1.3 + i));   // idle
    return out;
  }

  function draw(t, dt) {
    const tg = targets(t);
    for (let i = 0; i < COLS; i++) {
      // fast attack, slow release — reads like a real meter
      lvl[i] += (tg[i] - lvl[i]) * (tg[i] > lvl[i] ? 0.6 : 1 - Math.exp(-dt * 6));
      if (lvl[i] >= peak[i]) { peak[i] = lvl[i]; peakHold[i] = 0.35; }
      else if ((peakHold[i] -= dt) < 0) peak[i] = Math.max(lvl[i], peak[i] - dt * 0.5);
    }
    const p = img.data; p.fill(0);
    const base = Math.round(floor * H);
    for (let i = 0; i < COLS; i++) {
      const x0 = i * (CELL + GAP), hgt = Math.round(lvl[i] * base * 0.95), pk = base - Math.round(peak[i] * base * 0.95);
      for (let y = base - 1; y >= base - hgt && y >= 0; y--) {
        const up = (base - y) / Math.max(1, hgt);                     // 0 at the bottom → 1 at the top of the bar
        const fill = 0.9 - 0.65 * up;                                   // solid at the base, dithered toward the tip
        if (y % 3 === 2) continue;                                      // LCD segment gaps
        for (let x = x0; x < x0 + CELL; x++) {
          if (fill <= BAYER[(y & 3) * 4 + (x & 3)]) continue;
          const k = (y * W + x) * 4; p[k] = rgb[0]; p[k + 1] = rgb[1]; p[k + 2] = rgb[2]; p[k + 3] = 92;   // translucent: the dancer stays the focus
        }
      }
      // peak-hold cap
      if (peak[i] > 0.08) for (let x = x0; x < x0 + CELL; x++) { const k = (Math.max(0, pk - 2) * W + x) * 4; p[k] = rgb[0]; p[k + 1] = rgb[1]; p[k + 2] = rgb[2]; p[k + 3] = 150; }
    }
    g.putImageData(img, 0, 0);
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    if (now - scrolling > 140 && now - last > 32) { last = now; draw(now / 1000, dt); }   // ~30 fps, paused mid-scroll
    if (!reducedMotion) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  kick();

  return {
    // sit exactly in the dancer's sprite box, bars rising from his floor line
    place({ left, top, width, height, floor: fl }) {
      floor = fl ?? floor;
      Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      if (reducedMotion) draw(0, 0.016);
    },
  };
}
