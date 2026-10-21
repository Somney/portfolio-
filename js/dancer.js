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
const L = { thigh: 21.5, shin: 21, ankle: 3, spine: 29, chest: 18, neck: 13.5, upper: 19.5, fore: 18.5,   /* human proportions: fingertips reach mid-thigh */ head: 10.5 };

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

// Two-bone IK. `pole` is the fixed bend side (+1 / -1).
function ik(a, t, l1, l2, pole, mem, key, minFrac = 0, softFrac = 0.04) {
  const dx = t.x - a.x, dy = t.y - a.y;
  // minFrac keeps the target out of the fully-folded dead spot where the joint can spin
  const raw = Math.hypot(dx, dy), dMin = Math.max(Math.abs(l1 - l2) + 0.01, minFrac * (l1 + l2));
  // "soft reach": ease into full extension instead of snapping straight
  const reach = l1 + l2, soft = softFrac * reach;
  const d = clamp(raw > reach - soft ? reach - soft * Math.exp(-(raw - (reach - soft)) / soft) : raw, dMin, reach - 0.01);
  let base = Math.atan2(dy, dx);
  // near the shoulder the direction is unstable (a target passing through
  // it would flip the arm 180°) — hold the previous direction instead
  const pd = mem && mem[key + "dir"];
  if (pd != null && raw < dMin * 1.6) {
    let delta = base - pd; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    base = pd + delta * clamp((raw - dMin * 0.4) / (dMin * 1.2), 0, 1) * 0.35;
  }
  if (mem) mem[key + "dir"] = base;
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  // joints bend one way only, like real elbows and knees — so they can never flip
  const joint = V(a.x + Math.cos(base + pole * A) * l1, a.y + Math.sin(base + pole * A) * l1);
  return { joint, end: V(a.x + Math.cos(base) * d, a.y + Math.sin(base) * d) };
}
const POLE = { knee: 1, freeElbow: -1, podElbow: -1 };   // knees bend forward, elbows fold the other way

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
    const d = dip(f), sway = side * (2 * leadE - 1);                 // −1…+1, continuous across beats
    const hipX = (fN.x + fF.x) / 2 + 2 * sway;
    return { ...BASE, hip: V(hipX, 44 - 3.2 * d), lean: 0.08 + 0.05 * d, roll: 1.5 * d, nod: 0.22 * d, tilt: -0.06 * sway,
      fN, fF, tN: side > 0 ? 0.5 * (1 - leadE) : 0.5 * trailE, tF: side > 0 ? 0.5 * trailE : 0.5 * (1 - leadE),   // heel rises on the tap, lowers as it steps
      hand: V(hipX + 24 + 5 * (1 - d), 100 + 28 * d), pod: V(8, -3 + 1.5 * d) };     // fist pump up and out, clear of the face
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
      hand: V(-2 + 17 * swing, 52 + 9 * Math.abs(swing)), pod: V(9, -2 + 1.5 * dip(f)) };   // big bent-arm swing: behind the back ↔ out front
  } },
  { name: "body roll", beats: 4, pose(u) {
    const w = Math.PI * u, f = u % 1;                                  // one roll per 2 beats
    const hx = 2 * Math.sin(w);
    return { ...BASE, hip: V(hx, 41 - 2.5 * Math.sin(w)), lean: 0.14 * Math.sin(w + 1.2), roll: 3.5 * Math.sin(w + 2.1),
      nod: 0.24 * dip((u * 2) % 1), tilt: 0.12 * Math.sin(w), fN: V(11, 3), fF: V(-11, 3),
      hand: V(hx + 20 + 5 * Math.sin(w), 78 + 11 * Math.sin(w * 0.5 + 0.6)), pod: V(8, -3) };   // smooth wave out in front
  } },
  { name: "spin → disco point", beats: 4, pose(u) {
    const f = u % 1, spin = win(u, 0.2, 1.2);
    const tuck = { ...BASE, hip: V(0, 47 - 2 * arc(spin)), lean: 0, fN: V(3, 3), fF: V(-3, 3), tN: 0.45 * arc(spin), tF: 0.45 * arc(spin),
      hand: V(-10, 80), pod: V(7, -2), nod: -0.05, turn: spin < 1 ? spin * Math.PI * 2 : 0 };
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
      hand: V(-15 + 3 * Math.sin(Math.PI * uu), 58 + 2 * Math.cos(Math.PI * uu)), pod: V(8, -2), turn };   // loose arm swinging behind
  } },
];
const CYCLE = MOVES.reduce((n, m) => n + m.beats, 0);
const BLEND = 0.9; // beats of cross-fade between moves

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
function rigPoints(P, mem = null) {
  const hip = P.hip;
  const chest = add(add(hip, rot(L.chest, P.lean)), V(P.roll, 0));
  const neck = add(add(hip, rot(L.spine, P.lean)), V(P.roll * 0.6, 0));
  const headAng = P.lean * 1.4 + P.tilt;
  const head = add(neck, rot(L.neck, headAng + P.nod * 0.5));
  const shN = add(neck, V(2, -4.5)), shF = add(neck, V(-3, -3.5));
  const hpN = add(hip, V(2, -1)), hpF = add(hip, V(-2.5, -1));
  const ankN = V(P.fN.x, P.fN.y + Math.sin(P.tN) * 9), ankF = V(P.fF.x, P.fF.y + Math.sin(P.tF) * 9);
  const legN = ik(hpN, ankN, L.thigh, L.shin, POLE.knee, mem, "kN"), legF = ik(hpF, ankF, L.thigh, L.shin, POLE.knee, mem, "kF");
  // the iPod is held out in front at belly height: elbow at the side, forearm forward
  const podHand = add(chest, V(P.pod.x + 6, P.pod.y - 6));
  // The free hand follows its target as a swing around the shoulder
  // (angle + reach), never a straight line through it — arms arc like real
  // arms, and the slight trail adds follow-through.
  let hand = P.hand;
  if (mem) {
    const k = 1 - Math.exp(-(P.dt || 1 / 60) * 14);
    const tx = P.hand.x - shF.x, ty = P.hand.y - shF.y;
    const ta = Math.atan2(ty, tx), tr = Math.max(Math.hypot(tx, ty), 0.5 * (L.upper + L.fore));
    if (mem.ha == null) { mem.ha = ta; mem.hr = tr; }
    let da = ta - mem.ha; da = Math.atan2(Math.sin(da), Math.cos(da));
    mem.ha += da * k; mem.hr += (tr - mem.hr) * k;
    hand = V(shF.x + Math.cos(mem.ha) * mem.hr, shF.y + Math.sin(mem.ha) * mem.hr);
  }
  const armN = ik(shN, podHand, L.upper, L.fore, POLE.podElbow, mem, "eN", 0.4, 0.15), armF = ik(shF, hand, L.upper, L.fore, POLE.freeElbow, mem, "eF", 0.45, 0.15);
  return { hip, chest, neck, head, headAng: headAng + P.nod, shN, shF, hpN, hpF, legN, legF, armN, armF, podHand };
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
    push(-5, -3); push(10, -3);                                       // thick flat sole
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; push(10 + Math.cos(a) * 3, 0 + Math.sin(a) * 3); }
    push(5, 3.4); push(1, 4.6); push(-3.5, 4); push(-5, 1.5);         // high-top collar
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

    // helpers in head space (x = toward the face, y = up) and limb space
    const poly = (pts) => { g.beginPath(); pts.forEach((q, i) => { const [x, y] = sp(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); };
    const hpoly = (pts) => poly(pts.map(([x, y]) => hd(x, y)));
    const mitt = (end, from, r, thumbSide) => {                         // hand with a thumb
      circle(end, r);
      const dx = end.x - from.x, dy = end.y - from.y, l = Math.hypot(dx, dy) || 1;
      circle(add(end, V((-dy / l) * r * 0.9 * thumbSide + (dx / l) * 0.6, (dx / l) * r * 0.9 * thumbSide + (dy / l) * 0.6)), r * 0.45);
    };

    // skinny jeans + high-tops
    paint(lay.farLeg, () => { capsule(R.hpF, R.legF.joint, 4.3, 3.4); capsule(R.legF.joint, R.legF.end, 3.4, 2.7); shoe(R.legF.end, P.tF); });
    paint(lay.nearLeg, () => { capsule(R.hpN, R.legN.joint, 4.5, 3.5); capsule(R.legN.joint, R.legN.end, 3.5, 2.8); shoe(R.legN.end, P.tN); });
    // hoodie sleeves + hands
    paint(lay.farArm, () => { capsule(R.shF, R.armF.joint, 3.7, 3.1); capsule(R.armF.joint, R.armF.end, 3.1, 2.5); mitt(R.armF.end, R.armF.joint, 3, 1); });
    paint(lay.nearArm, () => { capsule(R.shN, R.armN.joint, 3.8, 3.2); capsule(R.armN.joint, R.armN.end, 3.2, 2.6); circle(R.armN.end, 3); });
    paint(lay.body, () => {
      // hoodie: broad shoulders, slim waist, open jacket flaps at the hem
      capsule(R.hip, R.chest, 6.6, 8.6); capsule(R.chest, R.neck, 8.6, 7.6); capsule(R.hpF, R.hpN, 5.6, 5.6);
      poly([add(R.hip, V(-6.5, 3)), add(R.hip, V(-7.8, -5.5)), add(R.hip, V(-1, -2.5))]);   // back flap
      poly([add(R.hip, V(4.5, 3)), add(R.hip, V(8.2, -5)), add(R.hip, V(1.5, -2))]);        // front flap
      circle(add(R.neck, V(-5.2, 0.5)), 4.4);                                                 // hood bunched at the nape
      capsule(R.neck, R.head, 3.2, 3.4);
      // face in profile: forehead, brow, nose, lips, chin, jaw
      circle(R.head, L.head);
      hpoly([[3, 8], [8.6, 5.4], [9.4, 3.2], [12.6, -0.6], [9.6, -2], [10.4, -3.6], [9.2, -4.8], [9.8, -6.4], [8, -8.6], [3.5, -10], [-3, -8], [-6, -3]]);
      // shaggy, spiky hair: bangs over the brow, volume on top, locks at the nape
      hpoly([[6, 3.2], [12, 3.6], [9.6, 6.6], [13.6, 8.2], [8.4, 9.8], [10.4, 14], [4.2, 12.4], [3.4, 17.6], [-1.6, 13.4],
             [-5.6, 17], [-7, 11.6], [-13.6, 12.4], [-10.6, 7.4], [-16, 5.2], [-11.4, 2.4], [-14.6, -2.6], [-9.2, -1.4],
             [-9.6, -6.6], [-5.6, -3], [-1, 4.5]]);
    });
    // big anime eye: negative space under the bangs
    const eg = lay.body.getContext("2d");
    eg.globalCompositeOperation = "destination-out"; g = eg;
    hpoly([[4.6, 2.6], [7.6, 2.2], [7.4, -0.2], [5, 0]]);
    g = main; eg.globalCompositeOperation = "source-over";

    // composite back → front
    g.clearRect(0, 0, LW, LH);
    g.drawImage(lay.farLeg, 0, 0);
    cut(g, lay.nearLeg); g.drawImage(lay.nearLeg, 0, 0);          // legs separate from each other
    cut(lay.farArm, lay.body);                                     // far arm tucks behind the body
    g.drawImage(lay.farArm, 0, 0); g.drawImage(lay.body, 0, 0);
    cut(g, lay.nearArm); g.drawImage(lay.nearArm, 0, 0);          // iPod arm reads in front of the hoodie

    // iPod held in the hand: white body (screen + click wheel), ink fingers
    // wrapping the back edge and a thumb resting on the front — clearly gripped
    const hand = R.armN.end, [hx, hy] = sp(hand), dir = S.ct >= 0 ? 1 : -1;
    const px = hx + 2.6 * dir, py = hy - 3.2;
    g.globalCompositeOperation = "destination-out";               // 1px gap so the iPod pops off the body
    g.beginPath(); g.roundRect(px - 6.2, py - 9, 12.4, 17.4, 2.6); g.fill();
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.beginPath(); g.arc(px + 2.4 * dir, py + 8.4, 2.8, 0, Math.PI * 2); g.fill();         // palm cupping the base
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(px - 5, py - 7.8, 10, 15.2, 2); g.fill();  // iPod body
    g.fillStyle = "#000"; g.fillRect(px - 3, py - 6, 6, 4.4);                                  // screen
    g.strokeStyle = "#000"; g.lineWidth = 1; g.beginPath(); g.arc(px, py + 2.6, 2.5, 0, Math.PI * 2); g.stroke(); // click wheel
    g.fillStyle = "#000";
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(px + 5.4 * dir, py - 0.6 + i * 2.7, 1.35, 0, Math.PI * 2); g.fill(); } // fingers wrap the edge
    g.beginPath(); g.ellipse(px - 5.2 * dir, py + 1.6, 1.25, 2.3, 0.35 * dir, 0, Math.PI * 2); g.fill();                     // thumb on the side

    // earbuds → Y just under the chin → into the top of the iPod
    const ear = hd(-3, -1.4), back = hd(-7.5, -6), split = add(R.neck, V(3.5, -8));
    const [ex, ey] = sp(ear), [bx, by] = sp(back), [sx, sy] = sp(split);
    g.strokeStyle = "#fff"; g.lineWidth = 1.3; g.lineCap = "round";
    g.beginPath(); g.moveTo(ex, ey); g.bezierCurveTo(ex - 0.5 * S.ct, ey - 7, sx - 3 * S.ct, sy + 3, sx, sy); g.stroke();   // hangs behind the jaw
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 3 * S.ct, sy - 1, sx, sy); g.stroke();
    g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx + 1 * S.ct, sy + 8, px - 2 * dir, py - 12, px - 1.5 * dir, py - 7.6); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, 1.8, 0, Math.PI * 2); g.fill();
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
  // Performance: in sprite mode the canvas covers only the sprite and is drawn
  // at G px per sprite pixel; CSS scales it up crisply (image-rendering: pixelated).
  const G = 1;   // draw at true sprite size; CSS does the (free, crisp) upscale
  let box = null;
  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height;
    const narrow = w < 720;
    if (img) {
      Object.assign(canvas.style, { inset: "0", width: "100%", height: "100%", left: "", top: "" });
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); box = null;
    } else {
      const s = Math.max(2, Math.floor(((narrow ? 0.52 : 0.8) * h * dpr) / 114)) / dpr;   // CSS px per sprite pixel
      const left = (narrow ? 0.68 : 0.72) * w - (LW * s) / 2, top = (narrow ? 0.995 : 0.965) * h - FLOOR * s;
      // LCD pixel grid as a static CSS mask: thin see-through lines between sprite pixels
      const line = Math.max(1, Math.round(s / 7)), cell = `${s}px ${s}px`;
      const mask = `linear-gradient(to right, #000 calc(100% - ${line}px), rgba(0,0,0,.68) 0), linear-gradient(to bottom, #000 calc(100% - ${line}px), rgba(0,0,0,.68) 0)`;
      Object.assign(canvas.style, { inset: "auto", left: `${left}px`, top: `${top}px`, width: `${LW * s}px`, height: `${LH * s}px`, imageRendering: "pixelated",
        maskImage: s * dpr >= 4 ? mask : "", webkitMaskImage: s * dpr >= 4 ? mask : "", maskSize: cell, webkitMaskSize: cell,
        maskComposite: "intersect", webkitMaskComposite: "source-in" });
      canvas.width = LW * G; canvas.height = LH * G; box = { s };
    }
    if (reducedMotion) frame(performance.now());
  };
  new ResizeObserver(resize).observe(canvas.parentElement);
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

  // Smoothness: hold the dancer still while the page is actively scrolling
  // (his frames then don't compete with the scroll) and cap him at ~30 fps,
  // which reads as a crisp LCD/handheld frame rate anyway.
  let scrolling = 0, lastDraw = 0;
  addEventListener("scroll", () => { scrolling = performance.now(); }, { passive: true });
  function frame(now) {
    raf = 0;
    if (!visible) return;
    if (!reducedMotion && (now - scrolling < 140 || now - lastDraw < 12)) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
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
      g.imageSmoothingEnabled = false;
      const S = G;
      // LCD persistence (faint trail) + the soft shadow LCD segments cast on their backing
      g.globalAlpha = 0.1; g.drawImage(ghost, 0, 0, LW * S, LH * S);
      g.globalAlpha = 0.2; g.drawImage(sh, 1, 1, LW * S, LH * S);
      g.globalAlpha = 1; g.drawImage(px, 0, 0, LW * S, LH * S);
      gg.clearRect(0, 0, LW, LH); gg.drawImage(sh, 0, 0);
      // (the LCD pixel grid is a static CSS mask — see resize)
    }
    if (!reducedMotion) raf = requestAnimationFrame(frame);
  }
  function drawImg() {}
  raf = requestAnimationFrame(frame);

  return { nextStyle() {} };
}

// exposed for previews/tests
export const _debug = { choreo, MOVES, LW, LH, rigPoints, makeDrawer };
