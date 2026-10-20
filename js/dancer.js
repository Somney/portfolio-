// Hero dancer — a Game & Watch / Game Boy Advance style LCD silhouette.
//
// How it works
//   • A small rig (hips, spine, head, IK arms & legs) is posed every frame
//     from a choreography of five dance moves that blend into each other.
//   • The figure is drawn into a tiny low-res canvas, snapped to 1-bit
//     (ink or white) pixels, then scaled up with crisp nearest-neighbour
//     pixels, an LCD shadow and a faint pixel grid.
//   • White earbuds + iPod stay as the two-tone accent.
// content.js → hero.silhouetteImage still swaps in your own cut-out.
import { reducedMotion } from "./util.js";

/* ---------------- sprite space (low-res pixels, y up from the floor) -------- */
const LW = 160, LH = 150, FLOOR = 144;          // canvas size + floor line (screen y)
const BPM = 112;
const L = { thigh: 21, shin: 21, ankle: 3, spine: 29, chest: 18, neck: 15, upper: 15.5, fore: 15, head: 12.5 };

/* ---------------- tiny math kit ---------------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };            // smoothstep
const win = (u, a, b) => ss((u - a) / (b - a));                                     // eased 0→1 over [a,b]
const dip = (f) => 0.5 + 0.5 * Math.cos(2 * Math.PI * f);                           // 1 on the beat
const arc = (f) => Math.sin(Math.PI * clamp(f, 0, 1));
const V = (x, y) => ({ x, y });
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const rot = (len, ang) => V(Math.sin(ang) * len, Math.cos(ang) * len);             // ang 0 = straight up

function ik(a, t, l1, l2, pick) {
  const dx = t.x - a.x, dy = t.y - a.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const j1 = V(a.x + Math.cos(base + A) * l1, a.y + Math.sin(base + A) * l1);
  const j2 = V(a.x + Math.cos(base - A) * l1, a.y + Math.sin(base - A) * l1);
  const end = V(a.x + Math.cos(base) * d, a.y + Math.sin(base) * d);
  return { joint: pick(j1, j2), end };
}
const kneeFwd = (p, q) => (p.x > q.x ? p : q);
const elbowDown = (p, q) => (p.y < q.y ? p : q);

/* ---------------- poses ----------------
   rootX  world slide (moonwalk)      hip   pelvis (local)
   lean   spine tilt fwd (+)          roll  chest push fwd
   nod    head nod (+ = down)         tilt  head tilt
   fN/fF  near/far ankle targets      tN/tF heel lift (rad)
   hand   free (far) hand target      pod   iPod hand offset from chest
   turn   facing angle (0 → right, π → left)                               */
const BASE = { rootX: 0, hip: V(0, 44), lean: 0.05, roll: 0, nod: 0, tilt: 0, fN: V(6, 3), fF: V(-6, 3), tN: 0, tF: 0,
  hand: V(6, 64), pod: V(8, -3), turn: 0 };

function mix(a, b, t) {
  const o = {};
  for (const k in a) o[k] = typeof a[k] === "number" ? lerp(a[k], b[k], t) : V(lerp(a[k].x, b[k].x, t), lerp(a[k].y, b[k].y, t));
  return o;
}

/* ---------------- choreography (u = beats into the move) ---------------- */
const MOVES = [
  { name: "step-touch + fist pump", beats: 8, pose(u) {
    const k = Math.floor(u), f = u - k, side = k % 2 ? -1 : 1;   // +1: weight goes right
    const OUT = 12, TAP = 3, leadE = win(f, 0, 0.5), trailE = win(f, 0.28, 0.8);
    let lead, trail;
    if (side > 0) { lead = V(lerp(-TAP, OUT, leadE), 3 + 5 * arc(f / 0.5)); trail = V(lerp(-OUT, TAP, trailE), 3 + 4 * arc((f - 0.28) / 0.52)); }
    else { lead = V(lerp(TAP, -OUT, leadE), 3 + 5 * arc(f / 0.5)); trail = V(lerp(OUT, -TAP, trailE), 3 + 4 * arc((f - 0.28) / 0.52)); }
    const fN = side > 0 ? lead : trail, fF = side > 0 ? trail : lead;  // near = right foot
    const d = dip(f), hipX = (fN.x + fF.x) / 2 + side * 2 * leadE;
    return { ...BASE, hip: V(hipX, 44 - 3.2 * d), lean: 0.08 + 0.05 * d, roll: 1.5 * d, nod: 0.22 * d, tilt: -0.06 * side,
      fN, fF, tN: side > 0 ? 0 : 0.5 * trailE, tF: side > 0 ? 0.5 * trailE : 0,
      hand: V(hipX + 7 + 5 * (1 - d), 92 + 20 * d), pod: V(8, -3 + 1.5 * d) };
  } },
  { name: "running man", beats: 8, pose(u) {
    const k = Math.floor(u), f = u - k, e = ss(f);
    const slider = V(7 - 16 * f, 3);                                   // planted foot slides back
    const lifter = V(lerp(-9, 7, e), 3 + 17 * arc(f));                // back foot sweeps up, lands in front
    const nearSlides = k % 2 === 0;
    const swing = Math.sin(Math.PI * u);
    return { ...BASE, hip: V(-1, 44 - 3 * dip(f) + 1.5 * arc(f)), lean: 0.14, roll: 1, nod: 0.18 * dip(f),
      fN: nearSlides ? slider : lifter, fF: nearSlides ? lifter : slider,
      tN: nearSlides ? 0 : 0.7 * arc(f), tF: nearSlides ? 0.7 * arc(f) : 0,
      hand: V(3 + 11 * swing, 64 + 6 * Math.abs(swing)), pod: V(9, -2 + 1.5 * dip(f)) };
  } },
  { name: "body roll", beats: 4, pose(u) {
    const w = Math.PI * u, f = u % 1;                                  // one roll per 2 beats
    const a = 1.75 + 1.0 * Math.sin(w * 0.5);                          // slow arc of the free arm
    const hx = 2 * Math.sin(w);
    return { ...BASE, hip: V(hx, 41 - 2.5 * Math.sin(w)), lean: 0.14 * Math.sin(w + 1.2), roll: 3.5 * Math.sin(w + 2.1),
      nod: 0.24 * dip((u * 2) % 1), tilt: 0.12 * Math.sin(w), fN: V(11, 3), fF: V(-11, 3),
      hand: V(hx + 29 * Math.cos(a), 72 + 27 * Math.sin(a)), pod: V(8, -3) };
  } },
  { name: "spin → disco point", beats: 4, pose(u) {
    const f = u % 1, spin = win(u, 0.2, 1.2);
    const tuck = { ...BASE, hip: V(0, 47 - 2 * arc(spin)), lean: 0, fN: V(3, 3), fF: V(-3, 3), tN: 0.45 * arc(spin), tF: 0.45 * arc(spin),
      hand: V(5, 76), pod: V(7, -2), nod: -0.05, turn: spin < 1 ? spin * Math.PI * 2 : 0 };
    const d = dip(f);
    const point = { ...BASE, hip: V(3 + 1.5 * d, 44 - 2 * d), lean: -0.1, roll: -1, nod: -0.05 * d, tilt: -0.25,
      fN: V(10, 3), fF: V(-9, 3), tN: 0.55, tF: 0,
      hand: V(26, 110 + 2 * d), pod: V(8, -4), turn: 0 };
    return mix(tuck, point, win(u, 1.3, 1.75));
  } },
  { name: "moonwalk + turnaround", beats: 8, pose(u) {
    const back = u < 4, uu = back ? u : u - 4, k = Math.floor(uu), f = uu - k;
    const e = ss(f), lift = 0.62;
    const slider = V(10 - 14 * e + 7 * f, 3), toe = V(3 + 7 * f, 3);  // feet in the hip's frame
    const nearSlides = k % 2 === 0;
    const pop = win(f, 0, 0.15);
    const rootX = back ? -7 * u : -28 + 7 * (u - 4);
    const turn = Math.PI * win(u, 3.55, 4.0);
    return { ...BASE, rootX, hip: V(0, 43 - 1.5 * dip(f)), lean: -0.04, roll: 0.5 * dip(f), nod: 0.15 * dip(f),
      fN: nearSlides ? slider : toe, fF: nearSlides ? toe : slider,
      tN: nearSlides ? lift * (1 - pop) : lift * pop, tF: nearSlides ? lift * pop : lift * (1 - pop),
      hand: V(-4 + 3 * Math.sin(Math.PI * uu), 60), pod: V(8, -2), turn };
  } },
];
const CYCLE = MOVES.reduce((n, m) => n + m.beats, 0);
const BLEND = 0.6; // beats of cross-fade between moves

function choreo(beat) {
  let u = ((beat % CYCLE) + CYCLE) % CYCLE, i = 0;
  while (u >= MOVES[i].beats) { u -= MOVES[i].beats; i++; }
  const cur = MOVES[i].pose(u);
  if (u < BLEND) {
    const prev = MOVES[(i + MOVES.length - 1) % MOVES.length];
    const p = prev.pose(prev.beats - 0.001 + u * 0.2);
    if (p.turn > Math.PI * 1.5) p.turn -= Math.PI * 2;
    return mix(p, cur, ss(u / BLEND));
  }
  return cur;
}

/* ---------------- drawing the figure into the low-res buffer ---------------- */
function rigPoints(P) {
  const hip = P.hip;
  const chest = add(add(hip, rot(L.chest, P.lean)), V(P.roll, 0));
  const neck = add(add(hip, rot(L.spine, P.lean)), V(P.roll * 0.6, 0));
  const headAng = P.lean * 1.4 + P.tilt;
  const head = add(neck, rot(L.neck, headAng + P.nod * 0.5));
  const shN = add(neck, V(1.5, -4)), shF = add(neck, V(-2, -3));
  const hpN = add(hip, V(2, -1)), hpF = add(hip, V(-2.5, -1));
  const ankN = V(P.fN.x, P.fN.y + Math.sin(P.tN) * 9), ankF = V(P.fF.x, P.fF.y + Math.sin(P.tF) * 9);
  const legN = ik(hpN, ankN, L.thigh, L.shin, kneeFwd), legF = ik(hpF, ankF, L.thigh, L.shin, kneeFwd);
  const podHand = add(chest, P.pod);
  const armN = ik(shN, podHand, L.upper, L.fore, elbowDown), armF = ik(shF, P.hand, L.upper, L.fore, elbowDown);
  return { hip, chest, neck, head, headAng: headAng + P.nod, shN, shF, hpN, hpF, legN, legF, armN, armF };
}

function makeDrawer(g) {  // g is swapped to a scratch canvas while building front parts
  let S = null; // screen transform for the current frame
  const sp = (p) => [S.cx + p.x * S.ct, FLOOR - p.y];
  function circle(p, r) { const [x, y] = sp(p); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function capsule(a, b, ra, rb) {
    const [ax, ay] = sp(a), [bx, by] = sp(b);
    const ang = Math.atan2(by - ay, bx - ax), dx = Math.cos(ang + Math.PI / 2), dy = Math.sin(ang + Math.PI / 2);
    // each piece filled on its own so overlaps never cancel into holes
    g.beginPath(); g.moveTo(ax + dx * ra, ay + dy * ra); g.lineTo(bx + dx * rb, by + dy * rb);
    g.lineTo(bx - dx * rb, by - dy * rb); g.lineTo(ax - dx * ra, ay - dy * ra); g.closePath(); g.fill();
    g.beginPath(); g.arc(ax, ay, ra, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(bx, by, rb, 0, Math.PI * 2); g.fill();
  }
  function shoe(ank, lift) {
    // rounded sneaker: heel at -3, toe at +10, sole 3 below the ankle; rotates around the ankle
    const pts = [];
    const push = (x, y) => { const c = Math.cos(-lift), s = Math.sin(-lift); pts.push(V(ank.x + x * c - y * s, ank.y + x * s + y * c)); };
    push(-4, -3); push(9, -3);
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; push(9 + Math.cos(a) * 2.6, -0.4 + Math.sin(a) * 2.6); }
    push(1, 3.2); push(-4, 2.5);
    g.beginPath(); pts.forEach((p, i) => { const [x, y] = sp(p); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fill();
  }
  // Layers: each body part group is drawn solid on its own canvas, then
  // composited with a 1px gap only where it should read as "in front".
  const mk = () => { const c = document.createElement("canvas"); c.width = LW; c.height = LH; return c; };
  const lay = { farLeg: mk(), nearLeg: mk(), farArm: mk(), body: mk(), nearArm: mk() };
  const RING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const main = g;
  function paint(c, build) { g = c.getContext("2d"); g.clearRect(0, 0, LW, LH); g.fillStyle = "#000"; build(); g = main; }
  function cut(dst, src) {           // erase src (grown by ~1px) out of dst
    const x = dst.getContext ? dst.getContext("2d") : dst;
    x.globalCompositeOperation = "destination-out";
    for (const [dx, dy] of RING) x.drawImage(src, dx * 1.25, dy * 1.25);
    x.globalCompositeOperation = "source-over";
  }

  return function draw(P) {
    const R = rigPoints(P);
    S = { cx: LW / 2 + P.rootX, ct: Math.cos(P.turn) };
    const hd = (x, y) => add(R.head, add(rot(y, R.headAng), rot(x, R.headAng + Math.PI / 2)));

    paint(lay.farLeg, () => { capsule(R.hpF, R.legF.joint, 4.6, 3.8); capsule(R.legF.joint, R.legF.end, 3.8, 3.2); shoe(R.legF.end, P.tF); });
    paint(lay.nearLeg, () => { capsule(R.hpN, R.legN.joint, 4.8, 3.9); capsule(R.legN.joint, R.legN.end, 3.9, 3.3); shoe(R.legN.end, P.tN); });
    paint(lay.farArm, () => { capsule(R.shF, R.armF.joint, 3.6, 3.1); capsule(R.armF.joint, R.armF.end, 3.1, 2.7); circle(R.armF.end, 3.9); });
    paint(lay.nearArm, () => { capsule(R.shN, R.armN.joint, 3.7, 3.2); capsule(R.armN.joint, R.armN.end, 3.2, 2.8); circle(R.armN.end, 3.9); });
    paint(lay.body, () => {
      capsule(R.hip, R.chest, 7.8, 9.6); capsule(R.chest, R.neck, 9.6, 6.2); capsule(R.hpF, R.hpN, 6.2, 6.2);
      capsule(R.neck, R.head, 3.6, 3.6);
      circle(R.head, L.head);
      circle(hd(11.4, -2.2), 3.9);                                         // nose
      // backwards cap: the head is the crown, the brim sticks out behind
      const brim = [hd(-6, 10.5), hd(-17.5, 7.5), hd(-18.5, 5.2), hd(-8, 6.2)];
      g.beginPath(); brim.forEach((q, i) => { const [x, y] = sp(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
      circle(hd(-1.5, 12.6), 1.6);                                       // cap button
      circle(hd(-10.5, -4), 3.2);                                        // back-of-head hair tuft
    });
    // eye: negative space
    const eg = lay.body.getContext("2d");
    eg.globalCompositeOperation = "destination-out"; g = eg; circle(hd(5.4, 2.9), 1.75); g = main;
    eg.globalCompositeOperation = "source-over";

    // composite back → front
    g.clearRect(0, 0, LW, LH);
    g.drawImage(lay.farLeg, 0, 0);
    cut(g, lay.nearLeg); g.drawImage(lay.nearLeg, 0, 0);          // legs separate from each other
    cut(lay.farArm, lay.body);                                     // far arm tucks behind the body
    g.drawImage(lay.farArm, 0, 0); g.drawImage(lay.body, 0, 0);
    g.drawImage(lay.nearArm, 0, 0);                                 // iPod arm merges into the chest like a real silhouette

    // iPod (white body, ink screen + wheel ring)
    const hand = R.armN.end, [px, py] = sp(V(hand.x + 1.5, hand.y + 4));
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(px - 4, py - 6, 8, 12, 1.6); g.fill();
    g.fillStyle = "#000"; g.fillRect(px - 2.6, py - 4.6, 5.2, 4);
    g.strokeStyle = "#000"; g.lineWidth = 1.1; g.beginPath(); g.arc(px, py + 2.6, 1.9, 0, Math.PI * 2); g.stroke();

    // earbuds → Y just under the chin → down to the iPod
    const ear = hd(-3.4, -2.8), back = hd(-9, -6), split = add(R.neck, V(4.5 , -5));
    const [ex, ey] = sp(ear), [bx, by] = sp(back), [sx, sy] = sp(split);
    g.strokeStyle = "#fff"; g.lineWidth = 1.3; g.lineCap = "round";
    g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + 2 * S.ct, (ey + sy) / 2, sx, sy); g.stroke();
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 3 * S.ct, sy - 1, sx, sy); g.stroke();
    g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx + 1 * S.ct, sy + 7, px + 6 * S.ct, py - 3, px, py - 6); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, 1.9, 0, Math.PI * 2); g.fill();
  };
}

/* ---------------- public: start the hero animation ---------------- */
export function startDancer(canvas, { ink = "#0d0d0d", image = null } = {}) {
  const g = canvas.getContext("2d");
  const lo = document.createElement("canvas"); lo.width = LW; lo.height = LH;
  const lg = lo.getContext("2d", { willReadFrequently: true });
  const px = document.createElement("canvas"); px.width = LW; px.height = LH;     // 1-bit result
  const pg = px.getContext("2d");
  const sh = document.createElement("canvas"); sh.width = LW; sh.height = LH;     // ink-only copy for shadows
  const shg = sh.getContext("2d");
  const ghost = document.createElement("canvas"); ghost.width = LW; ghost.height = LH; // LCD persistence
  const gg = ghost.getContext("2d");
  const draw = makeDrawer(lg);

  const inkRGB = (() => { const n = parseInt(ink.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })();
  let img = null;
  if (image) { img = new Image(); img.src = image; img.onerror = () => (img = null); }

  let w = 0, h = 0, dpr = 1, raf = 0, visible = true, grid = null, gridScale = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    if (reducedMotion) frame(performance.now());
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(canvas);

  // snap the anti-aliased drawing to pure ink / white pixels
  function quantize() {
    const d = lg.getImageData(0, 0, LW, LH), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 110) { p[i + 3] = 0; continue; }
      const white = p[i] > 140;
      p[i] = white ? 255 : inkRGB[0]; p[i + 1] = white ? 255 : inkRGB[1]; p[i + 2] = white ? 255 : inkRGB[2]; p[i + 3] = 255;
    }
    pg.putImageData(d, 0, 0);
    shg.clearRect(0, 0, LW, LH); shg.drawImage(px, 0, 0);
    shg.globalCompositeOperation = "source-in"; shg.fillStyle = ink; shg.fillRect(0, 0, LW, LH); shg.globalCompositeOperation = "source-over";
  }

  function gridPattern(s) {
    if (gridScale === s) return grid;
    const c = document.createElement("canvas"); c.width = c.height = s;
    const x = c.getContext("2d"), lw = Math.max(1, Math.round(s / 7));
    x.fillStyle = "rgba(0,0,0,.32)"; x.fillRect(s - lw, 0, lw, s); x.fillRect(0, s - lw, s, lw);
    gridScale = s; grid = g.createPattern(c, "repeat");
    return grid;
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const t = reducedMotion ? 0.9 : now / 1000;
    const narrow = w < 720;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);

    if (img) {
      if (img.complete && img.naturalWidth) {
        const H = (narrow ? 0.55 : 0.85) * h * dpr, W = (H * img.naturalWidth) / img.naturalHeight;
        const off = drawImg.off || (drawImg.off = document.createElement("canvas"));
        off.width = W; off.height = H;
        const o = off.getContext("2d"); o.drawImage(img, 0, 0, W, H);
        o.globalCompositeOperation = "source-in"; o.fillStyle = ink; o.fillRect(0, 0, W, H);
        g.drawImage(off, (narrow ? 0.7 : 0.72) * w * dpr - W / 2, h * dpr - H + Math.sin(t * 4) * 6);
      }
    } else {
      draw(choreo(t * BPM / 60));
      quantize();
      // integer pixel scale: the figure (~114 px tall) fills most of the hero
      const s = Math.max(2, Math.floor(((narrow ? 0.52 : 0.8) * h * dpr) / 114));
      const ox = Math.round((narrow ? 0.68 : 0.72) * w * dpr - (LW * s) / 2);
      const oy = Math.round((narrow ? 0.995 : 0.965) * h * dpr - FLOOR * s);
      g.imageSmoothingEnabled = false;
      // LCD persistence (faint trail) + the soft shadow LCD segments cast on their backing
      g.globalAlpha = 0.1; g.drawImage(ghost, ox, oy, LW * s, LH * s);
      g.globalAlpha = 0.2; g.drawImage(sh, ox + Math.round(s * 0.7), oy + Math.round(s * 0.7), LW * s, LH * s);
      g.globalAlpha = 1; g.drawImage(px, ox, oy, LW * s, LH * s);
      gg.clearRect(0, 0, LW, LH); gg.drawImage(sh, 0, 0);
      // LCD pixel grid on the lit pixels
      if (s >= 4) {
        g.globalCompositeOperation = "destination-out";
        g.translate(ox, oy); g.fillStyle = gridPattern(s); g.fillRect(0, 0, LW * s, LH * s);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over";
      }
    }
    if (!reducedMotion) raf = requestAnimationFrame(frame);
  }
  function drawImg() {}
  raf = requestAnimationFrame(frame);

  return { nextStyle() {} };
}

// exposed for previews/tests
export const _debug = { choreo, MOVES, LW, LH };
