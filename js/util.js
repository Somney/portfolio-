// Small shared helpers. Nothing in here needs editing to update content.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Deterministic random so layouts/placeholders look the same on every visit.
export function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Readable text colour (ink or paper) on top of a background colour.
export function contrastOn(hex, ink = "#0d0d0d", paper = "#f6f3ec") {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? ink : paper;
}

/* ---------- Placeholder art ----------
   Drawn on a canvas whenever a real image is missing, so the site always
   looks finished. kind: "cover" | "page" | "painting" | "extra"           */
export function placeholderCanvas(kind, seed, label = "", color = "#ff3ea5", w = 768, h = 1024) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const rnd = seeded(kind + seed);
  const ink = "#0d0d0d";

  if (kind === "page") {
    // off-white paper, faint grain, loose pencil scribbles + a few blobs
    g.fillStyle = "#f3efe4"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(0,0,0,${rnd() * 0.035})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const cx = w * (0.2 + rnd() * 0.6), cy = h * (0.15 + rnd() * 0.7), r = 60 + rnd() * 140;
      if (rnd() < 0.35) {
        g.fillStyle = color + "55";
        g.beginPath(); g.ellipse(cx, cy, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill();
      }
      g.strokeStyle = `rgba(20,20,20,${0.45 + rnd() * 0.4})`;
      g.lineWidth = 1.5 + rnd() * 2.5; g.lineCap = "round";
      g.beginPath();
      let x = cx + (rnd() - 0.5) * r, y = cy + (rnd() - 0.5) * r;
      g.moveTo(x, y);
      for (let i = 0; i < 26; i++) {
        const nx = cx + (rnd() - 0.5) * r * 2, ny = cy + (rnd() - 0.5) * r * 2;
        g.quadraticCurveTo(x + (rnd() - 0.5) * 80, y + (rnd() - 0.5) * 80, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,.35)"; g.font = `500 ${w * 0.03}px Space Grotesk, sans-serif`;
    g.fillText(label, w * 0.06, h * 0.95);
    return c;
  }

  if (kind === "cover") {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    // two-tone silhouette shapes
    g.fillStyle = ink;
    g.beginPath(); g.arc(w * (0.3 + rnd() * 0.4), h * 0.62, w * (0.28 + rnd() * 0.1), 0, 7); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.arc(w * 0.5, h * 0.62, w * 0.12, 0, 7); g.fill();
    g.fillStyle = ink;
    g.fillRect(0, h * 0.06, w, h * 0.004);
    g.font = `${w * 0.085}px "Rubik Mono One", Impact, sans-serif`;
    g.textBaseline = "top";
    wrap(g, label.toUpperCase(), w * 0.07, h * 0.1, w * 0.86, w * 0.1);
    // sticker
    g.save(); g.translate(w * 0.78, h * 0.86); g.rotate(-0.3);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, w * 0.09, 0, 7); g.fill();
    g.fillStyle = ink; g.font = `${w * 0.035}px "Rubik Mono One", sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("★", 0, 0);
    g.restore();
    return c;
  }

  // painting / extra: bold abstract two-tone composition
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.fillStyle = ink;
  const shapes = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < shapes; i++) {
    g.beginPath();
    const t = rnd();
    if (t < 0.4) g.arc(rnd() * w, rnd() * h, w * (0.15 + rnd() * 0.3), 0, 7);
    else if (t < 0.7) g.rect(rnd() * w * 0.6, rnd() * h * 0.6, w * (0.2 + rnd() * 0.4), h * (0.1 + rnd() * 0.5));
    else { g.moveTo(rnd() * w, 0); g.lineTo(w, rnd() * h); g.lineTo(rnd() * w, h); }
    g.fill();
    g.fillStyle = i % 2 ? ink : "#ffffff";
  }
  g.fillStyle = "rgba(255,255,255,.9)";
  g.font = `${w * 0.05}px "Rubik Mono One", sans-serif`;
  g.fillText(label.toUpperCase(), w * 0.06, h * 0.94);
  return c;
}

function wrap(g, text, x, y, maxW, lh) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? line + " " + word : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = word; y += lh; }
    else line = test;
  }
  g.fillText(line, x, y);
}

const urlCache = new Map();
export function placeholderURL(kind, seed, label, color, w, h) {
  const key = [kind, seed, label, color, w, h].join("|");
  if (!urlCache.has(key)) urlCache.set(key, placeholderCanvas(kind, seed, label, color, w, h).toDataURL("image/jpeg", 0.85));
  return urlCache.get(key);
}

// <img> that swaps itself to a placeholder if the file is missing.
export function smartImg(src, { kind = "painting", seed = src, label = "", color = "#c6ff00", alt = "" } = {}) {
  const img = new Image();
  img.alt = alt || label;
  img.decoding = "async";
  img.loading = "lazy";
  const fallback = () => { img.onerror = null; img.src = placeholderURL(kind, seed, label, color, 600, 750); img.dataset.placeholder = "1"; };
  img.onerror = fallback;
  if (src) img.src = src; else fallback();
  return img;
}
