// Animated iPod-ad style silhouette: solid ink figure, white earbuds + player.
// If content.hero.silhouetteImage is set, that image is used as the
// silhouette instead (turned solid ink, with a gentle bob).
import { reducedMotion } from "./util.js";

const L = { torso: 1.05, neck: 0.16, head: 0.27, upper: 0.56, fore: 0.52, thigh: 0.74, shin: 0.72 };

// angle 0 = pointing straight down, +angle swings toward +x
const at = (p, len, a) => ({ x: p.x + Math.sin(a) * len, y: p.y + Math.cos(a) * len });

function pose(t, style) {
  const b = t * (118 / 60) * Math.PI * 2; // 118 bpm
  const s = Math.sin(b), s2 = Math.sin(b / 2), up = Math.max(0, s), dn = Math.max(0, -s);
  const hip = { x: 0.14 * s2, y: -0.07 * Math.abs(s) };
  const lean = 0.13 * s2 + (style === 2 ? -0.12 : 0);
  const neck = { x: hip.x + Math.sin(lean) * L.torso, y: hip.y - Math.cos(lean) * L.torso };
  const head = { x: neck.x + Math.sin(lean * 1.6 + 0.12 * s) * (L.neck + L.head), y: neck.y - Math.cos(lean * 1.6) * (L.neck + L.head) };
  const shL = { x: neck.x - 0.2, y: neck.y + 0.1 }, shR = { x: neck.x + 0.2, y: neck.y + 0.1 };

  // left hand holds the player near the chest
  let uL = -0.45 + 0.08 * s, fL = uL - 2.35;
  // right arm: style 0 pump, 1 wave, 2 point
  let uR, fR;
  if (style === 0) { uR = 2.5 + 0.45 * s; fR = uR + 0.35 * Math.sin(b + 1); }
  else if (style === 1) { uR = 2.75 + 0.18 * s; fR = uR + 0.7 * Math.sin(b * 2); uL = -2.6 - 0.2 * s; fL = uL - 0.5; }
  else { uR = 1.75 + 0.12 * s; fR = uR + 0.15; }

  const elL = at(shL, L.upper, uL), hL = at(elL, L.fore, fL);
  const elR = at(shR, L.upper, uR), hR = at(elR, L.fore, fR);

  const hipL = { x: hip.x - 0.15, y: hip.y }, hipR = { x: hip.x + 0.15, y: hip.y };
  const tL = -0.12 - 0.55 * up, tR = 0.12 + 0.55 * dn;
  const kL = at(hipL, L.thigh, tL), kR = at(hipR, L.thigh, tR);
  const fLft = at(kL, L.shin, tL + 0.9 * up), fRgt = at(kR, L.shin, tR - 0.9 * dn);
  const holdLeft = style !== 1;
  return { hip, neck, head, shL, shR, elL, hL, elR, hR, hipL, hipR, kL, kR, fLft, fRgt, lean, holdLeft, fL, fR };
}

export function startDancer(canvas, { ink = "#0d0d0d", image = null } = {}) {
  const g = canvas.getContext("2d");
  let w = 0, h = 0, style = 0, img = null, raf = 0, visible = true;
  if (image) { img = new Image(); img.src = image; img.onerror = () => (img = null); }

  const resize = () => {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height; canvas.width = w * d; canvas.height = h * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) frame(performance.now()); }).observe(canvas);

  function limb(a, b, wdt) { g.lineWidth = wdt; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }

  function drawFigure(t) {
    const narrow = w < 720;
    const S = narrow ? h * 0.12 : h * 0.205;            // px per unit
    const ox = narrow ? w * 0.7 : w * 0.72, oy = narrow ? h * 0.99 - 1.46 * S : h * 0.95 - 1.46 * S;
    const p = pose(t, style);
    g.save(); g.translate(ox, oy); g.scale(S, S);
    g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = "round"; g.lineJoin = "round";

    limb(p.hipL, p.kL, 0.24); limb(p.kL, p.fLft, 0.2);
    limb(p.hipR, p.kR, 0.24); limb(p.kR, p.fRgt, 0.2);
    for (const f of [p.fLft, p.fRgt]) { g.beginPath(); g.ellipse(f.x + 0.06, f.y + 0.03, 0.16, 0.07, 0, 0, 7); g.fill(); }
    limb(p.hip, p.neck, 0.5);
    limb(p.shL, p.shR, 0.3);
    limb(p.neck, p.head, 0.16);
    g.beginPath(); g.arc(p.head.x, p.head.y, L.head, 0, 7); g.fill();
    // hair puff
    g.beginPath(); g.arc(p.head.x - 0.12, p.head.y - 0.12, L.head * 0.8, 0, 7); g.fill();
    limb(p.shL, p.elL, 0.2); limb(p.elL, p.hL, 0.17);
    limb(p.shR, p.elR, 0.2); limb(p.elR, p.hR, 0.17);
    for (const hd of [p.hL, p.hR]) { g.beginPath(); g.arc(hd.x, hd.y, 0.1, 0, 7); g.fill(); }

    // white earbuds → Y split → player in hand
    const hand = p.holdLeft ? p.hL : p.hR;
    const earL = { x: p.head.x - 0.2, y: p.head.y + 0.06 }, earR = { x: p.head.x + 0.2, y: p.head.y + 0.06 };
    const split = { x: p.neck.x + 0.02, y: p.neck.y + 0.42 };
    g.strokeStyle = "#fff"; g.lineWidth = 0.028;
    g.beginPath(); g.moveTo(earL.x, earL.y); g.quadraticCurveTo(earL.x - 0.02, split.y - 0.2, split.x, split.y); g.stroke();
    g.beginPath(); g.moveTo(earR.x, earR.y); g.quadraticCurveTo(earR.x + 0.05, split.y - 0.2, split.x, split.y); g.stroke();
    g.beginPath(); g.moveTo(split.x, split.y);
    g.bezierCurveTo(split.x, split.y + 0.5, hand.x + 0.4, hand.y + 0.35, hand.x, hand.y - 0.05); g.stroke();
    g.fillStyle = "#fff";
    for (const e of [earL, earR]) { g.beginPath(); g.arc(e.x, e.y, 0.05, 0, 7); g.fill(); }
    g.save(); g.translate(hand.x, hand.y - 0.08); g.rotate((p.holdLeft ? p.fL : p.fR) * 0.25);
    roundRect(g, -0.1, -0.17, 0.2, 0.34, 0.04); g.fill();
    g.fillStyle = "#c9c9c9"; g.beginPath(); g.arc(0, 0.06, 0.055, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0.06, 0.02, 0, 7); g.fill();
    g.fillStyle = "#9aa"; g.fillRect(-0.07, -0.14, 0.14, 0.09);
    g.restore();
    g.restore();
  }

  function drawImage(t) {
    if (!img.complete || !img.naturalWidth) return;
    const narrow = w < 720;
    const H = narrow ? h * 0.55 : h * 0.85, W = (H * img.naturalWidth) / img.naturalHeight;
    const x = (narrow ? w * 0.7 : w * 0.72) - W / 2, y = h - H + Math.sin(t * 4) * 6;
    // tint to solid ink using an offscreen canvas
    const off = drawImage.off || (drawImage.off = document.createElement("canvas"));
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.drawImage(img, 0, 0, W, H);
    o.globalCompositeOperation = "source-in"; o.fillStyle = ink; o.fillRect(0, 0, W, H);
    g.drawImage(off, x, y);
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const t = reducedMotion ? 0.3 : now / 1000;
    g.clearRect(0, 0, w, h);
    img ? drawImage(t) : drawFigure(t);
    if (!reducedMotion) raf = requestAnimationFrame(frame);
  }
  frame(performance.now());

  return { nextStyle() { style = (style + 1) % 3; if (reducedMotion) frame(performance.now()); } };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
