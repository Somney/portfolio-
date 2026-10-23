// 3D sketchbooks: a desk of scattered books + a full-screen page-flip viewer.
// Textures come from the folders listed in content.js; anything missing
// gets an auto-drawn placeholder.
import * as THREE from "three";
import { $, clamp, lerp, seeded, placeholderCanvas, easeOut, easeInOut, reducedMotion } from "./util.js";
import { splashTransition } from "./splash.js";
import { pageFlip, isMuted, setMuted } from "./sound.js";

/* ====================================================================
   Texture loading
   ==================================================================== */
const loader = new THREE.TextureLoader();
let maxAniso = 4;
const EXT_RETRY = [".png", ".webp", ".jpeg"];

function loadImage(url) {
  return new Promise((res, rej) => loader.load(url, res, undefined, rej));
}
// Try the path as written, then the same name with other extensions,
// then fall back to a drawn placeholder.
async function loadTex(url, fallback) {
  if (url) {
    const tries = [url];
    if (/\.jpg$/i.test(url)) for (const e of EXT_RETRY) tries.push(url.replace(/\.jpg$/i, e));
    for (const u of tries) {
      try { return prep(await loadImage(u)); } catch {}
    }
  }
  const t = prep(new THREE.CanvasTexture(fallback()));
  t.userData.placeholder = true;
  return t;
}
function prep(t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }

function bookPaths(b) {
  const f = (b.folder || "").replace(/\/$/, "");
  const join = (p) => (p.includes("/") ? p : `${f}/${p}`);
  const pages = b.pageList
    ? b.pageList.map(join)
    : Array.from({ length: b.pages || 0 }, (_, i) => `${f}/page-${String(i + 1).padStart(2, "0")}.jpg`);
  return { cover: b.cover ? join(b.cover) : `${f}/cover.jpg`, back: b.back ? join(b.back) : `${f}/back.jpg`, pages };
}

// Endpaper: book colour with a tiny ink star pattern.
function endpaperCanvas(color, seed) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 704;
  const g = c.getContext("2d"), r = seeded(seed.id ?? seed);
  g.fillStyle = color; g.fillRect(0, 0, 512, 704);
  if (seed.plain) {                                    // plain inside cover (e.g. kraft): just a little grain
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.06})`; g.fillRect(r() * 512, r() * 704, 2, 2); }
    return c;
  }
  g.fillStyle = "rgba(13,13,13,.85)"; g.font = "28px sans-serif"; g.textAlign = "center";
  for (let y = 30; y < 704; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < 540; x += 64) g.fillText(r() < 0.5 ? "✦" : "★", x, y);
  return c;
}
function edgeCanvas() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 128;
  const g = c.getContext("2d");
  for (let y = 0; y < 128; y += 2) { const v = 225 + Math.floor(Math.random() * 25); g.fillStyle = `rgb(${v},${v - 4},${v - 14})`; g.fillRect(0, y, 16, 2); }
  return c;
}
function shade(hex, f) {
  const c = new THREE.Color(hex); c.multiplyScalar(f); return c;
}

/* ====================================================================
   DESK — the scattered books you pick from
   ==================================================================== */
let shelf = null;
export const getShelf = () => shelf;

// Real-world sizes: content.js → sketchbooks[].size = [width, height] in inches.
// 1 scene unit = 5.25 in (Sketchbook 01's width). Without a size, a book is
// 1 unit wide and its height follows the cover photo's shape.
const UNIT_IN = 5.25;
let allBooks = [];
// book thickness in scene units (covers included); the old page-count guess if not set
function bookThick(b) {
  if (b.thickness) return b.thickness / UNIT_IN;
  return 0.07 + (b.pageList?.length || b.pages || 10) * 0.004;
}
// Rounded outer corners (content.js → corner, in inches). The spine side stays square.
function cornerR(b, w) { return b.corner && b.size ? (b.corner / b.size[0]) * w : 0; }
// alpha mask for a page/cover plane: u = 0 at the spine, 1 at the outer edge
const alphaCache = new Map();
function cornerAlpha(rFrac, aspect) {
  const key = rFrac.toFixed(4) + "|" + aspect.toFixed(3);
  if (alphaCache.has(key)) return alphaCache.get(key);
  const w = 256, h = Math.round(256 * aspect), r = rFrac * w;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff";
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, 0);
  g.lineTo(w, h - r); g.arc(w - r, h - r, r, 0, Math.PI / 2); g.lineTo(0, h); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); alphaCache.set(key, t); return t;
}
// a slab (w × h × 1 deep, centred) with the corners on the `outer` side (+1 = +x, -1 = -x) rounded
function roundedSlab(w, h, r, outer = 1) {
  const sh = new THREE.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  sh.moveTo(x0, y0); sh.lineTo(x1 - r, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + r);
  sh.lineTo(x1, y1 - r); sh.quadraticCurveTo(x1, y1, x1 - r, y1); sh.lineTo(x0, y1); sh.lineTo(x0, y0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 10 });
  // caps: uv across the shape; split the lid group into bottom (back) and top (cover)
  const pos = geo.attributes.position, uv = geo.attributes.uv, lid = geo.groups[0].count;
  for (let i = 0; i < lid; i++) uv.setXY(i, (pos.getX(i) - x0) / w, (pos.getY(i) - y0) / h);
  geo.clearGroups(); geo.addGroup(0, lid / 2, 1); geo.addGroup(lid / 2, lid / 2, 2); geo.addGroup(lid, pos.count - lid, 0);
  geo.translate(0, 0, -0.5);
  if (outer < 0) geo.rotateY(Math.PI);
  return geo;
}
function bookDims(b, aspect = 1.38) {
  if (Array.isArray(b.size) && b.size[0] > 0 && b.size[1] > 0) return { w: b.size[0] / UNIT_IN, h: b.size[1] / UNIT_IN, fixed: true };
  return { w: 1, h: aspect, fixed: false };
}

// Opening a book: the desk camera flies to its cover, then the viewer fades in with the
// cover at the same spot and size. Both sides use these so the hand-off lines up.
const COVER_TILT = 0.42;                                              // = the viewer's resting book tilt
const COVER_DIR = new THREE.Vector3(0, Math.cos(COVER_TILT), Math.sin(COVER_TILT));
const coverPx = (w, h) => Math.min(innerHeight * 0.6, innerWidth * 0.78 * (h / w));

export function initShelf({ books, theme, canvas, label, onOpen }) {
  allBooks = books;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 30 });
  sun.shadow.radius = 6; sun.shadow.bias = -0.0005;
  scene.add(sun);

  // cutting-mat desk: neon with an ink grid (two-tone)
  const matColor = new THREE.Color(theme.palette[2] || "#00e0ff");
  const mc = document.createElement("canvas"); mc.width = mc.height = 1024;
  const mg = mc.getContext("2d");
  mg.fillStyle = "#fff"; mg.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i <= 1024; i += 32) {
    mg.fillStyle = i % 160 === 0 ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.14)";
    mg.fillRect(i, 0, i % 160 === 0 ? 3 : 1.5, 1024); mg.fillRect(0, i, 1024, i % 160 === 0 ? 3 : 1.5);
  }
  mg.strokeStyle = "rgba(0,0,0,.25)"; mg.lineWidth = 2;
  mg.beginPath(); mg.moveTo(0, 0); mg.lineTo(1024, 1024); mg.moveTo(1024, 0); mg.lineTo(0, 1024); mg.stroke();
  const matTex = prep(new THREE.CanvasTexture(mc));
  matTex.wrapS = matTex.wrapT = THREE.RepeatWrapping; matTex.repeat.set(3, 3);
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: matTex, color: matColor, roughness: 0.95 })
  );
  mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true;
  scene.add(mat);

  const edgeTex = prep(new THREE.CanvasTexture(edgeCanvas()));
  const group = new THREE.Group(); scene.add(group);
  const unit = new THREE.BoxGeometry(1, 1, 1);

  const items = books.map((b, i) => {
    const r = seeded(b.id);
    const thick = bookThick(b);
    const coverMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const backMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6 });
    const edge = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
    const spine = new THREE.MeshStandardMaterial({ color: shade(b.color, 0.75), roughness: 0.5 });
    const mesh = new THREE.Mesh(unit, [edge, spine, coverMat, backMat, edge, edge]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const holder = new THREE.Group(); holder.add(mesh); group.add(holder);
    const d0 = bookDims(b);
    const it = { b, mesh, holder, thick, w: d0.w, h: d0.h, fixedSize: d0.fixed, rotJ: (r() - 0.5) * 0.6, jx: (r() - 0.5) * 0.35, jz: (r() - 0.5) * 0.35,
      phase: r() * 6, lift: 0, hoverT: 0, drop: reducedMotion ? 0 : 1, dropDelay: i * 0.09 };
    mesh.scale.set(it.w, thick, it.h);
    const rr = it.fixedSize ? cornerR(b, it.w) : 0;
    if (rr) {   // rounded notebook: lay a rounded slab flat (caps: 1 = back underneath, 2 = cover on top)
      const geo = roundedSlab(it.w, it.h, rr); geo.rotateX(-Math.PI / 2);
      mesh.geometry = geo; mesh.material = [edge, backMat, coverMat]; mesh.scale.set(1, thick, 1);
      mesh.geometry.translate(0, 0, 0);
    }
    mesh.position.y = thick / 2;
    const p = bookPaths(b);
    loadTex(p.cover, () => placeholderCanvas("cover", b.id, b.title, b.color, 512, 704)).then((t) => {
      coverMat.map = t; coverMat.needsUpdate = true;
      const img = t.image; if (img?.width && !it.fixedSize) { it.h = clamp(img.height / img.width, 0.6, 1.8); mesh.scale.z = it.h; layout(); }
    });
    loadTex(p.back, () => placeholderCanvas("cover", b.id + "back", "", b.color, 256, 352)).then((t) => {
      if (!t.userData.placeholder) { backMat.map = t; backMat.color.set(0xffffff); backMat.needsUpdate = true; }
    });
    mesh.userData.item = it;
    return it;
  });

  // "scattered but organised": grid + seeded jitter + slight rotation
  let bounds = { w: 4, d: 4 };
  function layout() {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const n = items.length;
    const cols = clamp(Math.round(Math.sqrt(n * aspect * 1.25)), 1, n);
    const rows = Math.ceil(n / cols);
    // spacing follows the biggest book so different sizes never overlap
    const mw = Math.max(...items.map((i) => i.w)), mh = Math.max(...items.map((i) => i.h));
    const sx = mw + 0.75, sz = mh + 0.65;
    items.forEach((it, i) => {
      const c = i % cols, rI = Math.floor(i / cols);
      const inRow = rI === rows - 1 ? n - rI * cols : cols;  // centre the last row
      it.x = (c - (inRow - 1) / 2) * sx + it.jx;
      it.z = (rI - (rows - 1) / 2) * sz + it.jz;
    });
    bounds = { w: cols * sx, d: rows * sz };
    fit();
  }
  // Camera = a point on the desk it looks at + a direction + a distance.
  // view.z / fx / fz is the pinch zoom; fx (zoomFx) flies into one book.
  const TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const baseDir = new THREE.Vector3(0, 0.86, 0.5).normalize();
  const view = { z: 1, fx: 0, fz: 0 };
  const cur = { look: new THREE.Vector3(0, 0, 0.35), dist: 10, dir: baseDir.clone() };
  let baseDist = 10, zoomFx = null;
  const baseView = () => ({ look: new THREE.Vector3(view.fx, 0, 0.35 + view.fz), dist: baseDist / view.z, dir: baseDir });
  const applyCam = (v) => {
    camera.position.copy(v.dir).multiplyScalar(v.dist).add(v.look);
    camera.lookAt(v.look);
  };
  function fit() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    baseDist = Math.max((bounds.w + 0.6) / (2 * TAN * camera.aspect), (bounds.d * 1.1 + 1.0) / (2 * TAN)) * 1.08;
    if (!zoomFx) { const b = baseView(); cur.look.copy(b.look); cur.dist = b.dist; cur.dir.copy(b.dir); applyCam(cur); }
  }
  new ResizeObserver(layout).observe(canvas);
  layout();

  // pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9);
  let hovered = null, downAt = null, mouse = { x: 0, y: 0 };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse = { x: ndc.x, y: ndc.y };
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(items.map((i) => i.mesh))[0];
    return hit ? hit.object.userData.item : null;
  };
  // ---- pinch / ctrl-scroll zoom on the desk, one-finger pan while zoomed ----
  const deskHit = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    return t > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, t) : null;
  };
  const clampView = () => {
    const free = 1 - 1 / view.z;
    view.fx = clamp(view.fx, -(bounds.w / 2) * free, (bounds.w / 2) * free);
    view.fz = clamp(view.fz, -(bounds.d / 2) * free - 0.2, (bounds.d / 2) * free + 0.2);
    canvas.style.touchAction = view.z > 1.02 ? "none" : "pan-y";   // zoomed in: one finger pans the desk
  };
  // zoom to z, keeping the desk point under (cx, cy) where it is
  const zoomAround = (P, z0, z, fx0, fz0) => {
    view.z = clamp(z, 1, 4);
    const s = z0 / view.z;
    view.fx = P.x + (fx0 - P.x) * s; view.fz = (P.z - 0.35) + (fz0 - (P.z - 0.35)) * s;
    if (view.z < 1.01) { view.z = 1; view.fx = view.fz = 0; }
    clampView();
  };
  const wpp = () => (2 * (baseDist / view.z) * TAN) / Math.max(1, canvas.clientHeight);   // world units per screen px
  const pts = new Map();
  let pinch = null, pan = null, gestured = false;
  canvas.addEventListener("touchstart", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => { if (e.touches.length > 1 || view.z > 1.02) e.preventDefault(); }, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAround(pinch.P, pinch.z0, pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d0), pinch.fx0, pinch.fz0);
      view.fx -= (mx - pinch.mx) * wpp(); view.fz -= ((my - pinch.my) * wpp()) / baseDir.y; clampView();
      return;
    }
    if (pan && pts.size === 1 && (pan.moved || Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 6)) {
      pan.moved = gestured = true;
      view.fx = pan.fx0 - (e.clientX - pan.x) * wpp(); view.fz = pan.fz0 - ((e.clientY - pan.y) * wpp()) / baseDir.y; clampView();
      return;
    }
    if (e.pointerType !== "touch") { hovered = zoomFx ? null : pick(e); canvas.style.cursor = hovered ? "pointer" : view.z > 1.02 ? "grab" : "default"; }
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; ndc.set(9, 9); });
  canvas.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const P = deskHit(mx, my);
      if (P) { pinch = { P, d0: Math.hypot(a.x - b.x, a.y - b.y), z0: view.z, fx0: view.fx, fz0: view.fz, mx, my }; gestured = true; pan = null; hovered = null; }
      return;
    }
    if (pts.size > 2) return;
    gestured = false;
    downAt = { x: e.clientX, y: e.clientY };
    if (view.z > 1.02) { canvas.setPointerCapture?.(e.pointerId); pan = { x: e.clientX, y: e.clientY, fx0: view.fx, fz0: view.fz, moved: false }; }
    if (!zoomFx) hovered = pick(e);
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size) return;
    pan = null;
    const tap = !gestured && downAt && e.type === "pointerup" && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) <= 8;
    downAt = null;
    if (e.pointerType === "touch") hovered = null;
    if (!tap || zoomFx) return;
    const it = pick(e);
    if (it) onOpen(it.b.id);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  // ctrl + scroll (and trackpad pinch, which arrives as ctrl + wheel); plain scrolling still scrolls the page
  canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey || zoomFx) return;
    e.preventDefault();
    const P = deskHit(e.clientX, e.clientY);
    if (P) zoomAround(P, view.z, view.z * Math.exp(-e.deltaY * 0.01), view.fx, view.fz);
  }, { passive: false });

  // label that follows the hovered book
  const lab = label, labT = $("strong", lab), labS = $("span", lab);
  const v3 = new THREE.Vector3();

  let visible = false, paused = false, t0 = performance.now(), last = t0, started = false;
  const clock = () => (performance.now() - t0) / 1000;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && !zoomFx && view.z > 1) { view.z = 1; view.fx = view.fz = 0; clampView(); } if (visible) { if (!started) { started = true; t0 = performance.now(); } loop(); } }, { threshold: 0.05 }).observe(canvas);

  const targetMat = new THREE.Color();
  let rafId = 0;
  function loop() {
    if (rafId || !visible || paused) return;
    rafId = requestAnimationFrame(frame);
  }
  function frame(now) {
    rafId = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = clock();
    const k = 1 - Math.exp(-dt * 10);
    // flying into / out of a book: fe = 0 (desk view) … 1 (cover fills the screen)
    let fe = 0;
    if (zoomFx) {
      const p = clamp((now - zoomFx.t0) / zoomFx.dur, 0, 1);
      if (p >= 0.8 && zoomFx.onNear) { zoomFx.onNear(); zoomFx.onNear = null; }
      fe = zoomFx.inward ? easeInOut(p) : 1 - easeInOut(p);
      if (p >= 1) { zoomFx.done?.(); zoomFx.done = null; if (!zoomFx.inward) zoomFx = null; }
    }
    const tilt = zoomFx ? 0 : 1;
    group.rotation.y = lerp(group.rotation.y, mouse.x * 0.06 * tilt * (view.z < 1.02), k * (zoomFx ? 1 : 0.3));
    group.rotation.x = lerp(group.rotation.x, -mouse.y * 0.03 * tilt * (view.z < 1.02), k * (zoomFx ? 1 : 0.3));
    for (const it of items) {
      const hov = it === hovered && !zoomFx;
      it.hoverT = lerp(it.hoverT, hov ? 1 : 0, k);
      const f = zoomFx && zoomFx.it === it ? fe : 0;        // the book being opened settles flat
      const dropP = clamp((t - it.dropDelay) / 0.7, 0, 1);
      const drop = it.drop ? (1 - easeOut(dropP)) * 4 + Math.sin(dropP * Math.PI) * 0.15 : 0;
      const bob = reducedMotion ? 0 : Math.sin(t * 1.4 + it.phase) * 0.02 * (1 - f);
      it.holder.position.set(it.x, drop + bob + it.hoverT * 0.45, it.z + it.hoverT * 0.15);
      it.holder.rotation.set(-it.hoverT * 0.32, it.rotJ * (1 - it.hoverT * 0.8) * (1 - f), it.hoverT * 0.04);
      it.holder.scale.setScalar(1 + it.hoverT * 0.06);
    }

    // camera: desk view (with pinch zoom), blended toward the opened book's cover
    const bv = baseView();
    const kk = pinch || pan ? 1 - Math.exp(-dt * 30) : k * 0.8;
    cur.look.lerp(bv.look, kk); cur.dist = lerp(cur.dist, bv.dist, kk); cur.dir.copy(bv.dir);
    if (zoomFx) {
      const cv = coverView(zoomFx.it), s = zoomFx.inward ? zoomFx.from : cur;
      const v = { look: s.look.clone().lerp(cv.look, fe), dist: Math.exp(lerp(Math.log(s.dist), Math.log(cv.dist), fe)), dir: s.dir.clone().lerp(cv.dir, fe).normalize() };
      applyCam(v);
    } else applyCam(cur);

    // the desk takes on the colour of the hovered book, or fades fully to it while opening
    const focusB = zoomFx ? zoomFx.it.b : hovered?.b;
    targetMat.set(focusB ? focusB.color : theme.palette[2] || "#00e0ff");
    if (focusB && focusB.color.toLowerCase() === "#f6f3ec") targetMat.set(theme.palette[2]);
    mat.material.color.lerp(targetMat, zoomFx ? 1 - Math.exp(-dt * 7) : k * 0.4);

    if (hovered) {
      hovered.holder.getWorldPosition(v3); v3.y += 0.4; v3.z -= hovered.h / 2; v3.project(camera);
      const r = canvas.getBoundingClientRect();
      lab.hidden = false;
      lab.style.transform = `translate(${(v3.x * 0.5 + 0.5) * r.width}px, ${(-v3.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`;
      if (labT.textContent !== hovered.b.title) { labT.textContent = hovered.b.title; labS.textContent = [hovered.b.year, hovered.b.note].filter(Boolean).join(" · "); }
    } else lab.hidden = true;

    renderer.render(scene, camera);
    loop();
  }

  // where the camera sits so a book's cover fills the screen the way the viewer first shows it
  function coverView(it) {
    const r = canvas.getBoundingClientRect();
    const look = group.localToWorld(new THREE.Vector3(it.x, it.thick, it.z));
    const dir = COVER_DIR.clone();
    const px = coverPx(it.w, it.h);                                      // cover height on screen, px
    const dist = (it.h * r.height) / (2 * TAN * px);
    // the viewer is full-screen; shift so the cover lands at the window's centre, not the canvas's
    const off = innerHeight / 2 - (r.top + r.height / 2);
    const up = new THREE.Vector3(0, dir.z, -dir.y);
    look.addScaledVector(up, off * (2 * dist * TAN) / Math.max(1, r.height));
    return { look, dist, dir };
  }

  shelf = {
    pause(v) { paused = v; if (!v) { last = performance.now(); loop(); } },
    // can we fly into a book? (the desk has to be on screen)
    canZoom() {
      const r = canvas.getBoundingClientRect();
      return visible && !paused && r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.7;
    },
    // fly into a book; resolves `near` a little before the cover fills the screen, `done` at the end
    zoomTo(id) {
      const it = items.find((i) => i.b.id === id);
      hovered = null; pinch = pan = null;
      const from = { look: camera.position.clone().sub(cur.dir.clone().multiplyScalar(cur.dist)), dist: cur.dist, dir: cur.dir.clone() };
      let near, done;
      const pn = new Promise((r) => (near = r)), pd = new Promise((r) => (done = r));
      zoomFx = { it, inward: true, t0: performance.now(), dur: reducedMotion ? 150 : 750, from, onNear: near, done };
      loop();
      return { near: pn, done: pd };
    },
    // back out of the book to the desk (called as the viewer fades away)
    zoomOut(id) {
      const it = items.find((i) => i.b.id === id);
      if (!it) return;
      view.z = 1; view.fx = view.fz = 0; clampView();
      const b = baseView(); cur.look.copy(b.look); cur.dist = b.dist;
      zoomFx = { it, inward: false, t0: performance.now(), dur: reducedMotion ? 150 : 700 };
      paused = false; last = performance.now(); loop();
    },
  };
  return shelf;
}

/* ====================================================================
   VIEWER — open a book and flip the pages
   ==================================================================== */
let V = null; // lazily-created viewer state

function createViewer() {
  const root = $(".viewer"), canvas = $(".viewer__canvas", root);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 80);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1.2, 1.8, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.radius = 5;
  scene.add(sun);

  // spinG turns the whole book (rotate button); book tilts inside it (vertical drag)
  const spinG = new THREE.Group(); scene.add(spinG);
  const book = new THREE.Group();
  book.rotation.x = -0.42;
  spinG.add(book);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.position.z = -0.012; ground.receiveShadow = true; book.add(ground);
  const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ visible: false }));
  book.add(hitPlane);

  V = { root, canvas, renderer, scene, camera, book, spinG, spin: 0, spinTarget: 0, tilt: -0.42, hitPlane, leaves: [], W: 1, H: 1.38, open: false,
    zoom: 1, fx: 0, fy: -0.04, gesture: false, cam: { x: 0, y: 0, d: 4 }, raf: 0, last: 0 };

  addEventListener("resize", () => V.open && fitViewer());
  bindViewerInput();
  return V;
}

/* ---- one leaf = one sheet of paper (front + back) ---- */
const SEG_X = 28, SEG_Y = 6;
function makeLeaf(W, H, frontTex, backTex, stiff, alpha = null) {
  const geo = new THREE.PlaneGeometry(W, H, SEG_X, SEG_Y);
  const cut = alpha ? { alphaMap: alpha, alphaTest: 0.5 } : {};
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.92, side: THREE.FrontSide, ...cut }));
  backTex.wrapS = THREE.RepeatWrapping; backTex.repeat.x = -1; backTex.offset.x = 1;
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.92, side: THREE.BackSide, ...cut }));
  for (const m of [front, back]) { m.castShadow = true; m.receiveShadow = true; }
  const g = new THREE.Group(); g.add(front, back);
  return { geo, group: g, front, back, W, H, stiff, p: 0, v: 0, target: 0, curl: 0, corner: 0, dragging: false, dirty: true };
}

function bendLeaf(leaf, i, L) {
  const { geo, W, H } = leaf;
  const pos = geo.attributes.position;
  const p = leaf.p;
  // stacked on whatever is below it on the right (unturned) or left (turned) side;
  // each leaf has its own thickness t (covers / the blank pages at the back are thick)
  const S = V.stack;
  const zR = S ? S.below[i] : (L - 1 - i) * 0.0035, zL = S ? S.above[i] : i * 0.0035, t = leaf.t || 0;
  const zBase = lerp(zR, zL, p) + t * (1 - p) + (leaf.stiff && !t ? 0.002 : 0);
  leaf.zBase = zBase;
  const theta = p * Math.PI;
  if (leaf.slab) {
    // thick leaf: the inner face sits t behind the outer one, the slab fills between
    leaf.back.position.set(Math.sin(theta) * t, 0, -Math.cos(theta) * t);
    leaf.slab.rotation.y = -theta; leaf.slab.position.z = zBase;
  }
  const ds = W / SEG_X;
  for (let r = 0; r <= SEG_Y; r++) {
    const yN = 1 - r / SEG_Y; // 1 = top row
    const y = (yN - 0.5) * H;
    const rowCurl = leaf.curl * (1 + leaf.corner * (yN - 0.5) * 1.3);
    let x = 0, z = 0;
    for (let c = 0; c <= SEG_X; c++) {
      if (c > 0) {
        const sMid = (c - 0.5) / SEG_X;
        const phi = clamp(theta + rowCurl * Math.pow(sMid, 1.4), 0.002, Math.PI - 0.002);
        x += Math.cos(phi) * ds; z += Math.sin(phi) * ds;
      }
      pos.setXYZ(r * (SEG_X + 1) + c, x, y, z + zBase);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  leaf.dirty = false;
}

async function buildBook(b) {
  const paths = bookPaths(b);
  const cover = await loadTex(paths.cover, () => placeholderCanvas("cover", b.id, b.title, b.color, 768, 1056));
  const img = cover.image;
  const aspect = img?.width ? clamp(img.height / img.width, 0.6, 1.8) : 1.38;
  const dm = bookDims(b, aspect), W = dm.w, H = dm.h;
  V.W = W; V.H = H;
  // the viewer frames every book against the biggest one, so sizes read true
  // (blended 60% toward the biggest so small books aren't tiny on a phone)
  const big = allBooks.length ? allBooks.map((x) => bookDims(x, x === b ? aspect : 1.38)) : [dm];
  V.refW = W + (Math.max(...big.map((d) => d.w)) - W) * 0.6;
  V.refH = H + (Math.max(...big.map((d) => d.h)) - H) * 0.6;

  const plainTex = (k) => loadTex(paths.pages[k], () => placeholderCanvas("page", b.id + k, `p. ${k + 1}`, b.color, 640, Math.round(640 * aspect)));
  V.layers = [];
  // a page with lift-able sticky notes is drawn on a canvas (base photo + peeled spots)
  const pageTex = (k, leafIdx, side) => {
    const cfg = b.layers?.[k + 1];
    if (!cfg?.lift || !cfg.notes?.length) return plainTex(k);
    const folder = (b.folder || "").replace(/\/$/, "");
    const liftUrl = cfg.lift.includes("/") ? cfg.lift : `${folder}/${cfg.lift}`;
    return Promise.all([loadImage(paths.pages[k]), loadImage(liftUrl)]).then(([bt, lt]) => {
      const notes = cfg.notes.map((n) => (n.overhang?.image && !n.overhang.image.includes("/") ? { ...n, overhang: { ...n.overhang, image: `${folder}/${n.overhang.image}` } } : n));
      const L = makeLayer(bt.image, lt.image, notes, leafIdx, side);
      V.layers.push(L);
      return L.tex;
    }).catch(() => plainTex(k));
  };
  const paperCanvas = () => { const c = document.createElement("canvas"); c.width = 64; c.height = 88; const g = c.getContext("2d"); g.fillStyle = "#f3efe4"; g.fillRect(0, 0, 64, 88); return c; };
  const backCover = await loadTex(paths.back, () => placeholderCanvas("cover", b.id + "back", "", b.color, 512, Math.round(512 * aspect)));

  const P = paths.pages.length;
  const sheets = Math.ceil(P / 2);
  const leaves = [];
  // front cover
  const rr = cornerR(b, W);
  const aPage = rr ? cornerAlpha(rr / W, H / W) : null, aCover = rr ? cornerAlpha((rr * 1.015) / (W * 1.015), (H * 1.02) / (W * 1.015)) : null;
  leaves.push(makeLeaf(W * 1.015, H * 1.02, cover, prep(new THREE.CanvasTexture(endpaperCanvas(b.inside || b.color, b.endpaper === false ? { id: b.id, plain: true } : b.id))), true, aCover));
  // paper: placeholder paper first, swap to real image when it arrives
  // Page pictures are loaded only for the sheets near the open spread (see syncPages):
  // a whole book's photos can be 500 MB of graphics memory, more than many laptops have.
  const paper = paperTex();
  for (let k = 0; k < sheets; k++) {
    const leaf = makeLeaf(W, H, paper, paper, false, aPage);
    leaves.push(leaf);
    const fi = 2 * k, bi = 2 * k + 1;
    leaf.pages = { front: () => pageTex(fi, k + 1, "front"), back: bi < P ? () => pageTex(bi, k + 1, "back") : null };
    leaf.texState = 0; leaf.gen = 0;
  }
  // ---- thickness: the book always has its real thickness (content.js → thickness);
  // pages not uploaded yet are a block of blank paper riding on the back cover ----
  const T = bookThick(b);
  const tb = b.hardcover ? 0.075 / UNIT_IN : 0.0016;                 // cover board
  const Tp = Math.max(0, T - 2 * tb);
  const g = sheets ? Math.min(Tp / sheets, 0.008) : 0;               // one sheet of paper
  const rest = Math.max(0, Tp - sheets * g);                          // the unused pages
  // back cover: inside shows blank paper when there are unused pages
  const backInside = rest > 0.004 ? prep(new THREE.CanvasTexture(paperCanvas())) : prep(new THREE.CanvasTexture(endpaperCanvas(b.inside || b.color, b.endpaper === false ? { id: b.id + "b", plain: true } : b.id + "b")));
  leaves.push(makeLeaf(W * 1.015, H * 1.02, backInside, backCover, true, aCover));
  const edgeH = prep(new THREE.CanvasTexture(edgeCanvas())), edgeV = edgeH.clone();
  edgeV.center.set(0.5, 0.5); edgeV.rotation = Math.PI / 2; edgeV.needsUpdate = true;
  const sideMats = (tex) => tex ? [new THREE.MeshStandardMaterial({ map: edgeV, roughness: 0.95 })] : [new THREE.MeshStandardMaterial({ color: shade(b.color, 0.8), roughness: 0.6 })];
  const paperSide = sideMats(true)[0], paperEnd = new THREE.MeshStandardMaterial({ map: edgeH, roughness: 0.95 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const boxMats = (paper) => paper ? [paperSide, paperSide, paperEnd, paperEnd, hidden, hidden] : (() => { const m = sideMats(false)[0]; return [m, m, m, m, hidden, hidden]; })();
  V.boxMats = [paperSide, paperEnd, hidden, edgeH, edgeV];
  // a slab hangs under a thick leaf's outer face, hinged at the spine
  const addSlab = (lf, t, paper) => {
    lf.t = t;
    if (t < 0.003) return;
    const geo = new THREE.BoxGeometry(lf.W * (paper ? 0.985 : 1), lf.H * (paper ? 0.985 : 1), t * 0.97);
    geo.translate(lf.W / 2, 0, -t / 2);
    lf.slab = new THREE.Mesh(geo, boxMats(paper)); lf.slab.castShadow = true; lf.slab.receiveShadow = true;
    lf.group.add(lf.slab);
    lf.slabMats = paper ? [] : [lf.slab.material[0]];
  };
  addSlab(leaves[0], tb, false);
  for (let k = 1; k < leaves.length - 1; k++) leaves[k].t = g;
  addSlab(leaves[leaves.length - 1], tb + rest, rest > tb);
  // where each leaf rests: on top of the thickness of everything under it, per side
  const ts = leaves.map((l) => l.t);
  // (plus a hair of air between sheets so neighbouring faces never sit at the same depth and flicker)
  const AIR = 0.0018;
  V.stack = { air: AIR,
    below: ts.map((_, i) => ts.slice(i + 1).reduce((a, v) => a + v, 0) + (ts.length - 1 - i) * AIR),
    above: ts.map((_, i) => ts.slice(0, i).reduce((a, v) => a + v, 0) + i * AIR) };
  // paper blocks fill the stack under the open pages so the edges read solid
  V.blocks = [1, -1].map((side) => {
    const bm = boxMats(true);
    const m = rr ? new THREE.Mesh(roundedSlab(W * 0.985, H * 0.985, rr * 0.985, side), [paperSide, hidden, hidden])
                 : new THREE.Mesh(new THREE.BoxGeometry(W * 0.985, H * 0.985, 1), bm);
    m.castShadow = true; m.receiveShadow = true; m.visible = false; V.book.add(m); return m;
  });

  // art drawn on the inside of the covers
  const coverArt = (file, mat, mirror) => {
    if (!file) return;
    const url = file.includes("/") ? file : `${(b.folder || "").replace(/\/$/, "")}/${file}`;
    loadImage(url).then((t) => {
      prep(t); if (mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
      mat.map?.dispose(); mat.map = t; mat.needsUpdate = true;
    }).catch(() => {});
  };
  coverArt(b.insideFront, leaves[0].back.material, true);
  coverArt(b.insideBack, leaves[leaves.length - 1].front.material, false);
  const L = leaves.length;
  leaves.forEach((lf, i) => { V.book.add(lf.group); bendLeaf(lf, i, L); });
  return { leaves, P };
}

// one shared blank-paper texture for every sheet that isn't showing its picture
let PAPER = null;
function paperTex() {
  if (!PAPER) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 88;
    const g = c.getContext("2d"); g.fillStyle = "#f3efe4"; g.fillRect(0, 0, 64, 88);
    PAPER = prep(new THREE.CanvasTexture(c)); PAPER.userData.shared = true;
  }
  return PAPER;
}
const freeMap = (t) => { if (t && !t.userData?.shared) t.dispose(); };
function setMap(mat, t, mirror) {
  if (mirror && !t.userData?.shared) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
  freeMap(mat.map); mat.map = t; mat.needsUpdate = true;
}
// keep pictures loaded for the sheets within a few turns of the open spread, free the rest
const PAGE_WINDOW = 3;
function syncPages() {
  if (!V?.leaves.length) return;
  const n = turnedCount(), L = V.leaves.length;
  for (let i = 1; i < L - 1; i++) {
    const lf = V.leaves[i];
    if (!lf.pages) continue;
    const want = Math.abs(i - n) <= PAGE_WINDOW || Math.abs(i - (n - 1)) <= PAGE_WINDOW;
    if (want && lf.texState === 0) {
      lf.texState = 1; const gen = ++lf.gen;
      for (const side of ["front", "back"]) {
        const load = lf.pages[side];
        if (!load) continue;
        load().then((t) => {
          if (lf.gen !== gen || !V.leaves.includes(lf)) { freeMap(t); dropLayers(lf, side); return; }
          setMap(lf[side].material, t, side === "back");
        });
      }
    } else if (!want && lf.texState) {
      lf.texState = 0; lf.gen++;
      for (const side of ["front", "back"]) { setMap(lf[side].material, paperTex(), false); dropLayers(lf, side); }
    }
  }
}
function dropLayers(lf, side) {
  const i = V.leaves.indexOf(lf);
  V.layers = V.layers.filter((L) => { const drop = L.leafIdx === i && L.side === side; if (drop) dropOverhangs(L); return !drop; });
}

function disposeBook() {
  for (const lf of V.leaves) {
    V.book.remove(lf.group);
    lf.geo.dispose(); lf.gen = (lf.gen || 0) + 1;
    for (const m of [lf.front.material, lf.back.material]) { freeMap(m.map); m.dispose(); }
    if (lf.slab) { lf.slab.geometry.dispose(); lf.slabMats.forEach((m) => m.dispose()); }
  }
  for (const m of V.blocks || []) { V.book.remove(m); m.geometry.dispose(); }
  for (const m of V.boxMats || []) m.dispose();
  V.blocks = []; V.boxMats = []; V.stack = null;
  (V.layers || []).forEach(dropOverhangs);
  V.leaves = []; V.layers = [];
}

/* ---- sticky notes: a layered page peels notes up to show the photo underneath ---- */
function makeLayer(base, lift, notes, leafIdx, side) {
  const c = document.createElement("canvas");
  c.width = base.width; c.height = base.height;
  const g = c.getContext("2d");
  // each note's colour (for its curled underside), sampled from the base photo
  const sc = document.createElement("canvas"); sc.width = sc.height = 1;
  const sg = sc.getContext("2d", { willReadFrequently: true });
  const N = notes.map((note) => {
    const poly = Array.isArray(note) ? note : note.points;
    const phi = ((Array.isArray(note) ? 0 : note.peel) || 0) * Math.PI / 180;   // peel direction, clockwise from up
    const pts = poly.map(([x, y]) => [x * c.width, y * c.height]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const cx = xs.reduce((a, v) => a + v, 0) / xs.length, cy = ys.reduce((a, v) => a + v, 0) / ys.length;   // middle of the note
    sg.drawImage(base, cx - 4, cy + (box.y1 - cy) * 0.5, 8, 8, 0, 0, 1, 1);
    const [r, gg, bb] = sg.getImageData(0, 0, 1, 1).data;
    // positions along the peel direction ("local y": the free edge is the largest)
    const ly = pts.map(([x, y]) => -((x - cx) * Math.sin(phi) - (y - cy) * Math.cos(phi)));
    const fr = { cx, cy, phi, y0: Math.min(...ly), y1: Math.max(...ly), r: Math.hypot(box.x1 - box.x0, box.y1 - box.y0) };
    const over = Array.isArray(note) ? null : note.overhang;   // part of the lifted note that sticks out past the page edge
    return { poly, pts, box, fr, over, col: `rgb(${Math.min(255, r + 18)},${Math.min(255, gg + 18)},${Math.min(255, bb + 18)})`, p: 0, target: 0, user: false };
  });
  const tex = prep(new THREE.CanvasTexture(c));
  const L = { c, g, base, lift, notes: N, tex, leafIdx, side, peeked: false };
  for (const n of N) if (n.over?.image) addOverhang(L, n);
  drawLayer(L);
  return L;
}
function drawLayer(L) {
  const { g, c, base, lift } = L;
  g.drawImage(base, 0, 0, c.width, c.height);
  const path = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  for (const n of L.notes) {
    const e = easeInOut(n.p);
    if (e < 0.002) continue;
    const { pts, fr } = n, h = fr.y1 - fr.y0, R = fr.r;
    // the note lifts from its free edge toward its sticky edge (along its own tilt):
    // past the fold you see what's underneath. Drawn in the note's rotated frame.
    const fold = fr.y1 - e * h * 1.12;
    const curl = Math.min(h * 0.16, c.height * 0.035) * Math.sin(Math.min(1, e) * Math.PI);
    const frame = () => { g.translate(fr.cx, fr.cy); g.rotate(fr.phi); };
    g.save();
    path(pts); g.clip();
    frame(); g.beginPath(); g.rect(-R, fold, 2 * R, R * 2); g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lift, 0, 0, c.width, c.height);
    frame();
    const sh = g.createLinearGradient(0, fold, 0, fold + curl * 2.2 + 4);    // soft shadow under the lifted edge
    sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh; g.fillRect(-R, fold, 2 * R, curl * 2.2 + 4);
    g.restore();
    if (curl > 0.5) {
      // the curled-up underside of the note, just behind the fold
      g.save();
      path(pts); g.clip();
      frame();
      const cg = g.createLinearGradient(0, fold - curl, 0, fold);
      cg.addColorStop(0, n.col); cg.addColorStop(0.7, n.col); cg.addColorStop(1, "rgba(0,0,0,.25)");
      g.fillStyle = cg; g.fillRect(-R, fold - curl, 2 * R, curl);
      g.restore();
    }
  }
  L.tex.needsUpdate = true;
}
// a flat picture beside the page (outer edge), shown as the note lifts over onto it
function addOverhang(L, n) {
  const lf = V.leaves[L.leafIdx]; if (!lf) return;
  const w = (n.over.width || 0.4) * lf.W;
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, lf.H), mat);
  mesh.visible = false; mesh.renderOrder = 2;
  lf.group.add(mesh);
  n.mesh = mesh; n.meshLeaf = lf; n.meshX = (L.side === "front" ? 1 : -1) * (lf.W + w / 2);
  loadImage(n.over.image).then((t) => { prep(t); mat.map = t; mat.color.setScalar(0.92); mat.needsUpdate = true; }).catch(() => {});
}
function dropOverhangs(L) {
  for (const n of L.notes) if (n.mesh) { n.meshLeaf.group.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh.material.map?.dispose(); n.mesh.material.dispose(); n.mesh = null; }
}
function stepOverhangs(L) {
  for (const n of L.notes) {
    if (!n.mesh) continue;
    const e = easeInOut(n.p), show = layerOnShow(L) && e > 0.02;
    n.mesh.visible = show;
    if (!show) continue;
    n.mesh.material.opacity = clamp((e - 0.45) / 0.45, 0, 1);
    n.mesh.position.set(n.meshX, 0, (n.meshLeaf.zBase || 0) + 0.004 + 0.02 * Math.sin(e * Math.PI));
  }
}
function stepLayers(dt) {
  for (const L of V.layers) {
    stepOverhangs(L);
    let dirty = false;
    for (const n of L.notes) {
      if (n.p === n.target) continue;
      const sp = dt / (n.user ? 0.5 : 0.3);
      n.p = n.target > n.p ? Math.min(n.target, n.p + sp) : Math.max(n.target, n.p - sp);
      dirty = true;
    }
    if (dirty) drawLayer(L);
    // first time the page lies open: each note gives a little lift so people know they can
    if (!L.peeked && layerOnShow(L)) {
      L.peeked = true;
      showHint("tap the sticky notes to lift them");
      if (!reducedMotion) L.notes.forEach((n, i) => {
        setTimeout(() => { if (!n.user && V.layers.includes(L)) n.target = 0.22; }, 500 + i * 220);
        setTimeout(() => { if (!n.user && V.layers.includes(L)) n.target = 0; }, 500 + i * 220 + 420);
      });
    }
  }
}
// is this page lying open and still (not mid-turn)?
function layerOnShow(L) {
  const lf = V.leaves[L.leafIdx];
  if (!lf) return false;
  if (L.side === "front") return lf.p < 0.01 && lf.target === 0 && (V.leaves[L.leafIdx - 1]?.p ?? 1) > 0.99;
  return lf.p > 0.99 && lf.target === 1 && (V.leaves[L.leafIdx + 1]?.p ?? 0) < 0.01;
}
// the sticky note under a screen point, if any
const noteRay = new THREE.Raycaster(), noteNdc = new THREE.Vector2();
function noteAt(x, y) {
  if (!V.layers.length) return null;
  const r = V.canvas.getBoundingClientRect();
  noteNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  noteRay.setFromCamera(noteNdc, V.camera);
  const hit = noteRay.intersectObjects(V.leaves.flatMap((l) => [l.front, l.back]), false)[0];
  if (!hit?.uv) return null;
  for (const L of V.layers) {
    const lf = V.leaves[L.leafIdx];
    if (hit.object !== (L.side === "front" ? lf.front : lf.back) || !layerOnShow(L)) continue;
    const px = L.side === "front" ? hit.uv.x : 1 - hit.uv.x, py = 1 - hit.uv.y;
    const n = L.notes.find((n) => inPoly(px, py, n.poly));
    if (n) return n;
  }
  return null;
}
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function toggleNote(n) {
  n.user = true;
  n.target = n.target >= 1 ? 0 : 1;
  pageFlip(0.35);
}
function showHint(text) {
  const h = $(".viewer__hint", V.root);
  if (!h) return;
  h.textContent = text;
  h.style.animation = "none"; void h.offsetWidth; h.style.animation = "";
}


function fitViewer() {
  const r = V.canvas.getBoundingClientRect();
  V.renderer.setSize(r.width, r.height, false);
  V.camera.aspect = r.width / Math.max(1, r.height);
  V.camera.updateProjectionMatrix();
  const tan = Math.tan(THREE.MathUtils.degToRad(V.camera.fov / 2));
  V.tan = tan;
  V.fitD = fitDistance(V.spin);
}
// camera distance that fits the open spread, for any rotation of the book
function fitDistance(spin) {
  const portrait = V.camera.aspect < 0.9;
  const sw = (V.refW || V.W) * 2 * (portrait ? 1.16 : 1.32), sh = (V.refH || V.H) * 1.55 * (0.8 + 0.2 * Math.cos(V.tilt));
  const c = Math.abs(Math.cos(spin)), n = Math.abs(Math.sin(spin));
  const w = c * sw + n * sh, h = n * sw + c * sh;
  return Math.max(w / (2 * V.tan * V.camera.aspect), h / (2 * V.tan));
}
function rotateBook(dir = -1) {
  V.spinTarget += dir * Math.PI / 2; resetZoom();
}

/* ---- state helpers ---- */
const turnedCount = () => V.leaves.filter((l) => l.target === 1).length;
function updateCount() {
  const n = turnedCount(), L = V.leaves.length, P = V.P;
  let txt;
  if (n === 0) txt = "cover";
  else if (n === L) txt = "back cover";
  else {
    const left = n - 1 >= 1 ? 2 * (n - 1) : null, right = 2 * n - 1;
    const pages = [left, right].filter((x) => x && x <= P);
    txt = pages.length ? `p. ${pages.join("–")} <i>/ ${P}</i>` : "inside cover";
  }
  $(".viewer__count", V.root).innerHTML = txt;
  syncPages();
  const id = V.bookData.id;
  history.replaceState(null, "", `#sketchbook/${id}${n ? "/" + n : ""}`);
}
function flip(dir) {
  if (dir > 0) {
    const lf = V.leaves.find((l) => l.target === 0 && !l.dragging);
    if (!lf) return;
    lf.target = 1; lf.v = Math.max(lf.v, 0.8);
  } else {
    const lf = [...V.leaves].reverse().find((l) => l.target === 1 && !l.dragging);
    if (!lf) return;
    lf.target = 0; lf.v = Math.min(lf.v, -0.8);
  }
  pageFlip();
  updateCount();
}

/* ---- input: drag pages, tap edges, keys ---- */
function bindViewerInput() {
  const { canvas, root } = V;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), local = new THREE.Vector3();
  let drag = null, lastTap = 0, pinch = null, lock = false, noteTimer = 0;
  const pts = new Map();
  const off = (x, y) => { const r = canvas.getBoundingClientRect(); return { x: x - r.left - r.width / 2, y: -(y - r.top - r.height / 2) }; };
  const releaseLeaf = () => { const lf = drag?.leaf; if (lf) { lf.dragging = false; lf.v = 0; } };

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, V.camera);
    const hit = ray.intersectObject(V.hitPlane)[0];
    if (!hit) return null;
    local.copy(hit.point); V.book.worldToLocal(local);
    return { x: local.x - V.offsetX, y: local.y };
  };

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {                                   // second finger: start a pinch
      releaseLeaf(); drag = null; lock = true;
      const [a, b] = [...pts.values()];
      const m = off((a.x + b.x) / 2, (a.y + b.y) / 2), z0 = V.zoom;
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0, wx: V.cam.x + m.x / pxPerUnit(z0), wy: V.cam.y + m.y / pxPerUnit(z0) };
      V.gesture = true; return;
    }
    if (lock || pts.size > 2) return;
    const p = toLocal(e); if (!p) return;
    drag = { x0: e.clientX, y0: e.clientY, start: p, leaf: null, moved: false, mode: null, hist: [], tilt0: V.tilt, fx0: V.fx, fy0: V.fy };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pts.size && e.pointerType === "mouse" && V.layers.length) canvas.style.cursor = noteAt(e.clientX, e.clientY) ? "pointer" : "";
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      // pinch: scale by finger spread, keep the pinched spot under the fingers (moving both pans)
      const [a, b] = [...pts.values()];
      const m = off((a.x + b.x) / 2, (a.y + b.y) / 2);
      V.zoom = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d0), ZMIN, 4);
      V.fx = pinch.wx - m.x / pxPerUnit(V.zoom); V.fy = pinch.wy - m.y / pxPerUnit(V.zoom);
      return;
    }
    if (!drag) return;
    if (V.zoom > 1.05) {                                     // zoomed in: one finger pans around the page
      const k = pxPerUnit(V.zoom);
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; drag.mode = "pan"; V.gesture = true; }
      if (drag.mode === "pan") { V.fx = drag.fx0 - (e.clientX - drag.x0) / k; V.fy = drag.fy0 + (e.clientY - drag.y0) / k; }
      return;
    }
    const p = toLocal(e); if (!p) return;
    const sx = e.clientX - drag.x0, sy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(sx, sy) > 8) {
      drag.moved = true;
      // which way is "across the pages" on screen right now (depends on rotation)?
      const s0 = V.spin, along = sx * Math.cos(s0) - sy * Math.sin(s0), perp = sx * Math.sin(s0) + sy * Math.cos(s0);
      if (Math.abs(perp) > Math.abs(along) * 1.2) drag.mode = "tilt";
      else {
        drag.mode = "flip";
        // direction of the swipe picks the page — grab anywhere, even mid-page or between pages
        const fwd = p.x - drag.start.x < 0;
        const lf = fwd ? V.leaves.find((l) => l.target === 0) : [...V.leaves].reverse().find((l) => l.target === 1);
        if (lf) { lf.dragging = true; lf.dir = fwd ? 1 : -1; lf.corner = clamp((drag.start.y / V.H) * 2, -1, 1); drag.leaf = lf; drag.p0 = lf.p; drag.x1 = p.x; pageFlip(0.5); }
      }
    }
    if (drag.mode === "tilt") {
      // finger toward the bottom of the page lays the book flat, toward the top tilts it back
      const perp = sx * Math.sin(V.spin) + sy * Math.cos(V.spin);
      V.tilt = clamp(drag.tilt0 + (perp / V.canvas.clientHeight) * 2.2, -1.05, 0);
      return;
    }
    const lf = drag.leaf;
    if (lf) {
      // move the page by how far the finger travelled (no jump to the finger position)
      const np = clamp(drag.p0 - (p.x - drag.x1) / (1.7 * V.W), 0, 1);
      const now = performance.now();
      drag.hist.push({ t: now, p: np }); while (drag.hist.length > 5) drag.hist.shift();
      lf.p = np; lf.dirty = true;
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; if (!pts.size) { lock = false; V.gesture = false; if (V.zoom > 0.93 && V.zoom < 1.08) resetZoom(); } return; }
    if (!pts.size) { lock = false; V.gesture = false; }
    if (!drag) return;
    if (drag.mode === "pan") { drag = null; return; }
    const lf = drag.leaf;
    if (lf) {
      const h = drag.hist, vel = h.length > 1 ? (h.at(-1).p - h[0].p) / Math.max(0.016, (h.at(-1).t - h[0].t) / 1000) : 0;
      lf.dragging = false; lf.v = clamp(vel, -6, 6);
      const commit = lf.dir > 0 ? lf.p > 0.45 || vel > 1.2 : lf.p < 0.55 || vel < -1.2;
      const before = lf.target;
      lf.target = lf.dir > 0 ? (commit ? 1 : 0) : (commit ? 0 : 1);
      if (lf.target !== before) { pageFlip(0.7); updateCount(); }
    } else if (!drag.moved) {
      const now = performance.now();
      const note = noteAt(drag.x0, drag.y0);
      if (now - lastTap < 300) { clearTimeout(noteTimer); Math.abs(V.zoom - 1) > 0.05 ? resetZoom() : zoomAt(off(drag.x0, drag.y0), 2.4); lastTap = 0; }
      else if (note) { lastTap = now; noteTimer = setTimeout(() => toggleNote(note), 220); }   // lift / lay down a sticky note (a double-tap zooms instead)
      else if (V.zoom > 1.05) lastTap = now;               // zoomed in: a single tap doesn't flip pages
      else {
        lastTap = now;
        const side = drag.start.x;
        setTimeout(() => { if (lastTap === now) flip(side > 0 ? 1 : -1); }, 220);
      }
    }
    drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(off(e.clientX, e.clientY), V.zoom * Math.exp(-e.deltaY * 0.0016));
    if (V.zoom > 0.97 && V.zoom < 1.02) resetZoom();
  }, { passive: false });
  canvas.addEventListener("pointercancel", end);

  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "next") flip(1);
    if (act === "prev") flip(-1);
    if (act === "close") closeViewer();
    if (act === "zoom") Math.abs(V.zoom - 1) > 0.05 ? resetZoom() : zoomAt({ x: V.canvas.clientWidth * 0.18, y: 0 }, 2.2);
    if (act === "rotate") rotateBook(-1);
    if (act === "sound") { setMuted(!isMuted()); syncSoundBtn(); }
  });
  addEventListener("keydown", (e) => {
    if (!V.open) return;
    if (e.key === "ArrowRight") flip(1);
    if (e.key === "ArrowLeft") flip(-1);
    if (e.key === "Escape") closeViewer();
    if (e.key === "r" || e.key === "R") rotateBook(e.shiftKey ? 1 : -1);
  });
}
function syncSoundBtn() { $('[data-act="sound"]', V.root).classList.toggle("off", isMuted()); }

// ---- zoom: V.zoom is the scale (1 = whole spread), V.fx/fy the camera centre ----
// pinch out below 1× to see past the page edges (e.g. a sticky note that flips off the page)
const ZMIN = 0.55;
function resetZoom() { V.zoom = 1; V.fx = 0; V.fy = -0.04; }
const pxPerUnit = (z) => V.canvas.clientHeight / (2 * V.tan * (V.fitD / z));
// zoom to z keeping the point under screen offset m (px from canvas centre, y up) fixed
function zoomAt(m, z) {
  const z0 = V.zoom, c = { x: V.cam.x, y: V.cam.y };
  const wx = c.x + m.x / pxPerUnit(z0), wy = c.y + m.y / pxPerUnit(z0);
  V.zoom = clamp(z, ZMIN, 4);
  V.fx = wx - m.x / pxPerUnit(V.zoom); V.fy = wy - m.y / pxPerUnit(V.zoom);
}

/* ---- animation loop: spring physics per leaf ---- */
function viewerFrame(now) {
  V.raf = 0;
  if (!V.open) return;
  const dt = Math.min(0.033, (now - V.last) / 1000); V.last = now;
  const L = V.leaves.length;
  const K = 55, C = 12.5;
  for (let i = 0; i < L; i++) {
    const lf = V.leaves[i];
    let curlTarget;
    if (lf.dragging) {
      curlTarget = Math.sin(lf.p * Math.PI) * 0.9 * lf.dir;           // the tip leads your finger
    } else {
      const a = (lf.target - lf.p) * K - lf.v * C;
      lf.v += a * dt; lf.p += lf.v * dt;
      if (lf.p < 0) { lf.p = 0; lf.v = 0; } if (lf.p > 1) { lf.p = 1; lf.v = 0; }
      if (Math.abs(lf.target - lf.p) < 0.0005 && Math.abs(lf.v) < 0.002) { if (lf.p !== lf.target) lf.dirty = true; lf.p = lf.target; lf.v = 0; }
      else lf.dirty = true;
      curlTarget = clamp(-lf.v * 0.22, -1, 1) * Math.sin(lf.p * Math.PI) * 1.6; // the tip trails behind in the air
      if (!lf.dragging && Math.abs(lf.v) < 0.01) lf.corner *= 0.9;
    }
    if (lf.stiff) curlTarget *= 0.08;
    const nc = lerp(lf.curl, curlTarget, 1 - Math.exp(-dt * 14));
    if (Math.abs(nc - lf.curl) > 1e-4) lf.dirty = true;
    lf.curl = nc;
    if (lf.dirty) bendLeaf(lf, i, L);
  }
  stepLayers(dt);
  // keep the visible part of the book centred (closed front / open / closed back)
  const pFirst = V.leaves[0].p, pLast = V.leaves[L - 1].p;
  V.offsetX = (-V.W / 2) * (1 - pFirst) + (V.W / 2) * pLast;
  V.leaves.forEach((lf) => (lf.group.position.x = V.offsetX));
  // paper blocks: the sheets on each side, sitting on that side's cover
  if (V.blocks?.length) {
    let hR = 0, hL = 0;
    const air = V.stack?.air || 0;
    for (let i = 1; i < L - 1; i++) { const lf = V.leaves[i]; hR += (1 - lf.p) * (lf.t + air); hL += lf.p * (lf.t + air); }
    const first = V.leaves[0], last = V.leaves[L - 1];
    const sides = [[V.blocks[0], V.W / 2, last.t * (1 - last.p), hR], [V.blocks[1], -V.W / 2, first.t * first.p, hL]];
    for (const [m, x, z0, h] of sides) {
      const hh = h - (V.leaves[1]?.t || 0) * 0.5 - air * 1.5;   // stays just under the top sheet
      m.visible = hh > 0.002;
      if (m.visible) { m.scale.z = hh; m.position.set(V.offsetX + x, 0, z0 + hh / 2); }
    }
  }

  // rotation + tilt glide smoothly to where they're set
  V.spin = lerp(V.spin, V.spinTarget, 1 - Math.exp(-dt * 9));
  V.book.rotation.x = lerp(V.book.rotation.x, V.tilt, 1 - Math.exp(-dt * 14));
  V.fitD = fitDistance(V.spin);

  // camera: fit or zoomed-in on a page (zoom point mapped through tilt + rotation)
  const k = 1 - Math.exp(-dt * 6);
  const tz = V.fitD / V.zoom;
  // keep the view on the book: the further in, the further you can pan (none at 1×)
  const cs = Math.abs(Math.cos(V.spin)), sn = Math.abs(Math.sin(V.spin)), free = Math.max(0, 1 - 1 / V.zoom);
  // room to pan a little past the page edges too (a sticky note can flip out past the page)
  const rx = (cs * V.W * 1.6 + sn * V.H / 2 * 1.3) * free, ry = (sn * V.W * 1.6 + cs * V.H / 2 * 1.3) * free;
  V.fx = clamp(V.fx, -rx, rx); V.fy = clamp(V.fy, -0.04 - ry, -0.04 + ry);
  const tx = V.fx, ty = V.fy;
  const kk = V.holdCam ? 0 : V.gesture ? 1 - Math.exp(-dt * 30) : k;   // follow fingers tightly, ease otherwise
  V.cam.d = lerp(V.cam.d, tz, kk); V.cam.x = lerp(V.cam.x, tx, kk); V.cam.y = lerp(V.cam.y, ty, kk);
  V.camera.position.set(V.cam.x, V.cam.y, V.cam.d);
  V.camera.lookAt(V.cam.x, V.cam.y, 0);

  // entrance: the book drops in
  if (V.intro < 1) V.intro = Math.min(1, (now - V.introStart) / 550);
  const ie = easeOut(V.intro);
  V.spinG.position.y = (1 - ie) * -1.2; V.spinG.rotation.z = V.spin + (1 - ie) * 0.25;

  V.renderer.render(V.scene, V.camera);
  V.raf = requestAnimationFrame(viewerFrame);
}

// fadeAfter: a promise (the desk's zoom into this book) — the viewer builds hidden, then
// fades in over it instead of using the splash.
export async function openViewer(b, startLeaf = 0, { fadeAfter = null } = {}) {
  if (!V) createViewer();
  if (V.open) disposeBook();
  if (!fadeAfter) shelf?.pause(true);
  V.bookData = b;
  V.root.classList.toggle("is-faded", !!fadeAfter);
  V.root.hidden = false;
  V.root.style.setProperty("--book", b.color);
  $(".viewer__title strong", V.root).textContent = b.title;
  $(".viewer__title span", V.root).textContent = [b.year, b.note].filter(Boolean).join(" · ");
  syncSoundBtn();
  const { leaves, P } = await buildBook(b);
  V.leaves = leaves; V.P = P; V.zoom = 1; V.fx = 0; V.fy = -0.04; V.intro = reducedMotion ? 1 : 0;
  V.spin = V.spinTarget = 0;                      // each book opens upright
  fitViewer();
  V.cam = { x: 0, y: 0, d: V.fitD };
  V.offsetX = -V.W / 2;
  // jump to a page from the URL, otherwise open the cover after a beat
  const target = clamp(+startLeaf || 0, 0, leaves.length);
  if (fadeAfter && !target) {
    // start with the closed cover exactly where the desk zoom leaves it, then ease back to the spread
    V.intro = 1;
    V.cam.d = (V.H * 1.02 * innerHeight) / (2 * V.tan * coverPx(V.W, V.H));
  }
  for (let i = 0; i < target; i++) { leaves[i].p = leaves[i].target = 1; leaves[i].dirty = true; }
  V.open = true; V.last = V.introStart = performance.now();
  updateCount();
  V.raf = requestAnimationFrame(viewerFrame);
  if (fadeAfter) {
    V.holdCam = true;                      // keep the camera on the cover until it's visible
    await fadeAfter;
    if (!V.open || V.bookData !== b) return;
    V.root.classList.remove("is-faded");
    V.last = V.introStart = performance.now();
    shelf?.pause(true);
    setTimeout(() => { V.holdCam = false; }, 200);
  }
  document.body.classList.add("no-scroll");
  if (!target) setTimeout(() => V.open && turnedCount() === 0 && flip(1), fadeAfter ? 650 : 750);
}

export async function closeViewer() {
  if (!V?.open) return;
  const id = V.bookData.id;
  if (shelf) {
    // fade the viewer away while the desk camera backs out of the book
    shelf.zoomOut(id);
    V.root.classList.add("is-faded");
    document.body.classList.remove("no-scroll");
    history.replaceState(null, "", "#sketchbooks");
    await new Promise((r) => setTimeout(r, 380));
    if (!V.root.classList.contains("is-faded")) return;   // reopened meanwhile
    V.open = false; cancelAnimationFrame(V.raf); V.raf = 0;
    disposeBook(); V.root.hidden = true; V.root.classList.remove("is-faded");
    return;
  }
  await splashTransition({
    color: "#0d0d0d", ink: V.bookData.color,
    onCovered: () => {
      V.open = false; cancelAnimationFrame(V.raf); V.raf = 0;
      disposeBook(); V.root.hidden = true;
      document.body.classList.remove("no-scroll");
      history.replaceState(null, "", "#sketchbooks");
      shelf?.pause(false);
    },
  });
}
