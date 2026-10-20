// 3D sketchbooks: a desk of scattered books + a full-screen page-flip viewer.
// Textures come from the folders listed in content.js; anything missing
// gets an auto-drawn placeholder.
import * as THREE from "three";
import { $, clamp, lerp, seeded, placeholderCanvas, easeOut, reducedMotion } from "./util.js";
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
  const g = c.getContext("2d"), r = seeded(seed);
  g.fillStyle = color; g.fillRect(0, 0, 512, 704);
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

export function initShelf({ books, theme, canvas, label, onOpen }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
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
    const thick = 0.07 + (b.pageList?.length || b.pages || 10) * 0.004;
    const coverMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const backMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6 });
    const edge = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
    const spine = new THREE.MeshStandardMaterial({ color: shade(b.color, 0.75), roughness: 0.5 });
    const mesh = new THREE.Mesh(unit, [edge, spine, coverMat, backMat, edge, edge]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const holder = new THREE.Group(); holder.add(mesh); group.add(holder);
    const it = { b, mesh, holder, thick, w: 1, h: 1.38, rotJ: (r() - 0.5) * 0.6, jx: (r() - 0.5) * 0.35, jz: (r() - 0.5) * 0.35,
      phase: r() * 6, lift: 0, hoverT: 0, drop: reducedMotion ? 0 : 1, dropDelay: i * 0.09 };
    mesh.scale.set(it.w, thick, it.h);
    mesh.position.y = thick / 2;
    const p = bookPaths(b);
    loadTex(p.cover, () => placeholderCanvas("cover", b.id, b.title, b.color, 512, 704)).then((t) => {
      coverMat.map = t; coverMat.needsUpdate = true;
      const img = t.image; if (img?.width) { it.h = clamp(img.height / img.width, 0.6, 1.8); mesh.scale.z = it.h; layout(); }
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
    const sx = 1.75, sz = 2.05;
    items.forEach((it, i) => {
      const c = i % cols, rI = Math.floor(i / cols);
      const inRow = rI === rows - 1 ? n - rI * cols : cols;  // centre the last row
      it.x = (c - (inRow - 1) / 2) * sx + it.jx;
      it.z = (rI - (rows - 1) / 2) * sz + it.jz;
    });
    bounds = { w: cols * sx, d: rows * sz };
    fit();
  }
  function fit() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((bounds.w + 0.6) / (2 * tan * camera.aspect), (bounds.d * 1.1 + 1.0) / (2 * tan)) * 1.08;
    const dir = new THREE.Vector3(0, 0.86, 0.5).normalize();
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0.35);
    camera.updateProjectionMatrix();
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
  canvas.addEventListener("pointermove", (e) => { hovered = pick(e); canvas.style.cursor = hovered ? "pointer" : "default"; });
  canvas.addEventListener("pointerleave", () => { hovered = null; ndc.set(9, 9); });
  canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; hovered = pick(e); });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
    const it = pick(e);
    if (it) { it.pickup = 1; setTimeout(() => onOpen(it.b.id), 280); }
  });

  // label that follows the hovered book
  const lab = label, labT = $("strong", lab), labS = $("span", lab);
  const v3 = new THREE.Vector3();

  let visible = false, paused = false, t0 = performance.now(), last = t0, started = false;
  const clock = () => (performance.now() - t0) / 1000;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { if (!started) { started = true; t0 = performance.now(); } loop(); } }, { threshold: 0.05 }).observe(canvas);

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
    group.rotation.y = lerp(group.rotation.y, mouse.x * 0.06, k * 0.3);
    group.rotation.x = lerp(group.rotation.x, -mouse.y * 0.03, k * 0.3);
    for (const it of items) {
      const hov = it === hovered;
      it.hoverT = lerp(it.hoverT, hov ? 1 : 0, k);
      if (it.pickup) it.pickup = Math.min(it.pickup + dt * 4, 2);
      const dropP = clamp((t - it.dropDelay) / 0.7, 0, 1);
      const drop = it.drop ? (1 - easeOut(dropP)) * 4 + Math.sin(dropP * Math.PI) * 0.15 : 0;
      const bob = reducedMotion ? 0 : Math.sin(t * 1.4 + it.phase) * 0.02;
      const pick = it.pickup ? (it.pickup - 1) : 0;
      it.holder.position.set(it.x, drop + bob + it.hoverT * 0.45 + pick * 1.5, it.z + it.hoverT * 0.15);
      it.holder.rotation.set(-it.hoverT * 0.32 - pick * 0.4, it.rotJ * (1 - it.hoverT * 0.8), it.hoverT * 0.04);
      it.holder.scale.setScalar(1 + it.hoverT * 0.06);
    }
    targetMat.set(hovered ? hovered.b.color : theme.palette[2] || "#00e0ff");
    if (hovered && hovered.b.color.toLowerCase() === "#f6f3ec") targetMat.set(theme.palette[2]);
    mat.material.color.lerp(targetMat, k * 0.4);

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

  shelf = {
    pause(v) { paused = v; if (!v) { last = performance.now(); items.forEach((i) => (i.pickup = 0)); loop(); } },
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
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
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
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.radius = 5;
  scene.add(sun);

  const book = new THREE.Group();
  book.rotation.x = -0.42;
  scene.add(book);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.position.z = -0.012; ground.receiveShadow = true; book.add(ground);
  const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ visible: false }));
  book.add(hitPlane);

  V = { root, canvas, renderer, scene, camera, book, hitPlane, leaves: [], W: 1, H: 1.38, open: false,
    zoom: 0, zoomX: 0, zoomY: 0, cam: { x: 0, y: 0, d: 4 }, raf: 0, last: 0 };

  addEventListener("resize", () => V.open && fitViewer());
  bindViewerInput();
  return V;
}

/* ---- one leaf = one sheet of paper (front + back) ---- */
const SEG_X = 28, SEG_Y = 6;
function makeLeaf(W, H, frontTex, backTex, stiff) {
  const geo = new THREE.PlaneGeometry(W, H, SEG_X, SEG_Y);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.92, side: THREE.FrontSide }));
  backTex.wrapS = THREE.RepeatWrapping; backTex.repeat.x = -1; backTex.offset.x = 1;
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.92, side: THREE.BackSide }));
  for (const m of [front, back]) { m.castShadow = true; m.receiveShadow = true; }
  const g = new THREE.Group(); g.add(front, back);
  return { geo, group: g, front, back, W, H, stiff, p: 0, v: 0, target: 0, curl: 0, corner: 0, dragging: false, dirty: true };
}

function bendLeaf(leaf, i, L) {
  const { geo, W, H } = leaf;
  const pos = geo.attributes.position;
  const gap = 0.0035;
  const p = leaf.p;
  const zBase = lerp((L - 1 - i) * gap, i * gap, p) + (leaf.stiff ? 0.002 : 0);
  const theta = p * Math.PI;
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
  const W = 1, H = aspect;
  V.W = W; V.H = H;

  const pageTex = (k) => loadTex(paths.pages[k], () => placeholderCanvas("page", b.id + k, `p. ${k + 1}`, b.color, 640, Math.round(640 * aspect)));
  const paperCanvas = () => { const c = document.createElement("canvas"); c.width = 64; c.height = 88; const g = c.getContext("2d"); g.fillStyle = "#f3efe4"; g.fillRect(0, 0, 64, 88); return c; };
  const backCover = await loadTex(paths.back, () => placeholderCanvas("cover", b.id + "back", "", b.color, 512, Math.round(512 * aspect)));

  const P = paths.pages.length;
  const sheets = Math.ceil(P / 2);
  const leaves = [];
  // front cover
  leaves.push(makeLeaf(W * 1.015, H * 1.02, cover, prep(new THREE.CanvasTexture(endpaperCanvas(b.color, b.id))), true));
  // paper: placeholder paper first, swap to real image when it arrives
  for (let k = 0; k < sheets; k++) {
    const leaf = makeLeaf(W, H, prep(new THREE.CanvasTexture(paperCanvas())), prep(new THREE.CanvasTexture(paperCanvas())), false);
    leaves.push(leaf);
    const fi = 2 * k, bi = 2 * k + 1;
    pageTex(fi).then((t) => { leaf.front.material.map.dispose(); leaf.front.material.map = t; leaf.front.material.needsUpdate = true; });
    (bi < P ? pageTex(bi) : Promise.resolve(prep(new THREE.CanvasTexture(paperCanvas())))).then((t) => {
      t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;
      leaf.back.material.map.dispose(); leaf.back.material.map = t; leaf.back.material.needsUpdate = true;
    });
  }
  // back cover
  leaves.push(makeLeaf(W * 1.015, H * 1.02, prep(new THREE.CanvasTexture(endpaperCanvas(b.color, b.id + "b"))), backCover, true));

  const L = leaves.length;
  leaves.forEach((lf, i) => { V.book.add(lf.group); bendLeaf(lf, i, L); });
  return { leaves, P };
}

function disposeBook() {
  for (const lf of V.leaves) {
    V.book.remove(lf.group);
    lf.geo.dispose();
    for (const m of [lf.front.material, lf.back.material]) { m.map?.dispose(); m.dispose(); }
  }
  V.leaves = [];
}

function fitViewer() {
  const r = V.canvas.getBoundingClientRect();
  V.renderer.setSize(r.width, r.height, false);
  V.camera.aspect = r.width / Math.max(1, r.height);
  V.camera.updateProjectionMatrix();
  const tan = Math.tan(THREE.MathUtils.degToRad(V.camera.fov / 2));
  const portrait = V.camera.aspect < 0.9;
  const spreadW = V.W * 2 * (portrait ? 1.1 : 1.32);
  V.fitD = Math.max(spreadW / (2 * tan * V.camera.aspect), (V.H * 1.55) / (2 * tan));
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
  let drag = null, lastTap = 0;

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
    const p = toLocal(e); if (!p) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, start: p, leaf: null, moved: false, hist: [] };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toLocal(e); if (!p) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) {
      drag.moved = true;
      const fwd = drag.start.x > 0;
      const lf = fwd ? V.leaves.find((l) => l.target === 0) : [...V.leaves].reverse().find((l) => l.target === 1);
      if (lf) { lf.dragging = true; lf.dir = fwd ? 1 : -1; lf.corner = clamp((drag.start.y / V.H) * 2, -1, 1); drag.leaf = lf; pageFlip(0.5); }
    }
    const lf = drag.leaf;
    if (lf) {
      // the page tip follows your finger
      const np = Math.acos(clamp(p.x / V.W, -1, 1)) / Math.PI;
      const now = performance.now();
      drag.hist.push({ t: now, p: np }); while (drag.hist.length > 5) drag.hist.shift();
      lf.p = np; lf.dirty = true;
    }
  });
  const end = (e) => {
    if (!drag) return;
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
      if (now - lastTap < 300) { toggleZoom(drag.start.x, drag.start.y); lastTap = 0; }
      else {
        lastTap = now;
        const side = drag.start.x;
        setTimeout(() => { if (lastTap === now) flip(side > 0 ? 1 : -1); }, 220);
      }
    }
    drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "next") flip(1);
    if (act === "prev") flip(-1);
    if (act === "close") closeViewer();
    if (act === "zoom") toggleZoom(V.zoom ? 0 : V.W * 0.5, 0);
    if (act === "sound") { setMuted(!isMuted()); syncSoundBtn(); }
  });
  addEventListener("keydown", (e) => {
    if (!V.open) return;
    if (e.key === "ArrowRight") flip(1);
    if (e.key === "ArrowLeft") flip(-1);
    if (e.key === "Escape") closeViewer();
  });
}
function syncSoundBtn() { $('[data-act="sound"]', V.root).classList.toggle("off", isMuted()); }

function toggleZoom(x, y) {
  if (V.zoom) { V.zoom = 0; return; }
  V.zoom = 1; V.zoomX = clamp(x, -V.W * 0.6, V.W * 0.6); V.zoomY = clamp(y, -V.H * 0.3, V.H * 0.3);
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
  // keep the visible part of the book centred (closed front / open / closed back)
  const pFirst = V.leaves[0].p, pLast = V.leaves[L - 1].p;
  V.offsetX = (-V.W / 2) * (1 - pFirst) + (V.W / 2) * pLast;
  V.leaves.forEach((lf) => (lf.group.position.x = V.offsetX));

  // camera: fit or zoomed-in on a page
  const k = 1 - Math.exp(-dt * 6);
  const tz = V.zoom ? V.fitD * 0.48 : V.fitD;
  const tx = V.zoom ? V.zoomX + V.offsetX : 0, ty = V.zoom ? V.zoomY * Math.cos(0.42) : -0.04;
  V.cam.d = lerp(V.cam.d, tz, k); V.cam.x = lerp(V.cam.x, tx, k); V.cam.y = lerp(V.cam.y, ty, k);
  V.camera.position.set(V.cam.x, V.cam.y, V.cam.d);
  V.camera.lookAt(V.cam.x, V.cam.y, 0);

  // entrance: the book drops in
  if (V.intro < 1) { V.intro = Math.min(1, (now - V.introStart) / 550); const e = easeOut(V.intro); V.book.position.y = (1 - e) * -1.2; V.book.rotation.z = (1 - e) * 0.25; }

  V.renderer.render(V.scene, V.camera);
  V.raf = requestAnimationFrame(viewerFrame);
}

export async function openViewer(b, startLeaf = 0) {
  if (!V) createViewer();
  if (V.open) disposeBook();
  shelf?.pause(true);
  V.bookData = b;
  V.root.hidden = false;
  V.root.style.setProperty("--book", b.color);
  $(".viewer__title strong", V.root).textContent = b.title;
  $(".viewer__title span", V.root).textContent = [b.year, b.note].filter(Boolean).join(" · ");
  syncSoundBtn();
  const { leaves, P } = await buildBook(b);
  V.leaves = leaves; V.P = P; V.zoom = 0; V.intro = reducedMotion ? 1 : 0;
  fitViewer();
  V.cam = { x: 0, y: 0, d: V.fitD };
  V.offsetX = -V.W / 2;
  V.open = true; V.last = V.introStart = performance.now();
  document.body.classList.add("no-scroll");
  // jump to a page from the URL, otherwise open the cover after a beat
  const target = clamp(+startLeaf || 0, 0, leaves.length);
  for (let i = 0; i < target; i++) { leaves[i].p = leaves[i].target = 1; leaves[i].dirty = true; }
  updateCount();
  if (!target) setTimeout(() => V.open && turnedCount() === 0 && flip(1), 750);
  V.raf = requestAnimationFrame(viewerFrame);
}

export async function closeViewer() {
  if (!V?.open) return;
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
