import content from "../content.js";
import { $, $$, el, esc, clamp, smartImg, contrastOn, reducedMotion } from "./util.js";
import { SplashBG, splashTransition } from "./splash.js";
import { startDancer } from "./dancer.js";
import { blip } from "./sound.js";

const { artist, theme, hero, paintings = [], sketchbooks = [], extras = [] } = content;
const INK = theme.ink, PAPER = theme.paper, PAL = theme.palette;

/* ---------- Theme + text ---------- */
const root = document.documentElement.style;
root.setProperty("--ink", INK);
root.setProperty("--paper", PAPER);
PAL.forEach((c, i) => root.setProperty(`--c${i}`, c));
document.title = `${artist.name} — Portfolio`;
$(".logo").textContent = artist.name;
$(".hero__name").textContent = artist.name;
$(".hero__tagline").textContent = artist.tagline;
$(".contact__bio").textContent = artist.bio;
$(".contact__email").textContent = artist.email;
$(".contact__email").href = `mailto:${artist.email}`;
$(".contact__name").textContent = artist.name;
$(".year").textContent = new Date().getFullYear();
for (const s of artist.socials || []) {
  const a = el("a", "chip", esc(s.label)); a.href = s.url; a.target = "_blank"; a.rel = "noopener";
  $(".contact__socials").append(a);
}

/* ---------- Hero: colour cycling + rotating words ---------- */
let heroIdx = 0;
const heroBG = new SplashBG($(".hero .splash-bg"), PAL[0], INK);
const dancer = startDancer($(".hero__dancer"), { ink: INK, image: hero.silhouetteImage });
const wordEl = $(".hero__words span");
wordEl.textContent = hero.words[0];
function heroNext(x, y) {
  heroIdx = (heroIdx + 1) % PAL.length;
  heroBG.to(PAL[heroIdx], x, y);
  setTimeout(() => {
    dancer.nextStyle();
    wordEl.classList.remove("pop"); void wordEl.offsetWidth;
    wordEl.textContent = hero.words[heroIdx % hero.words.length];
    wordEl.classList.add("pop");
  }, 260);
}
let heroTimer = reducedMotion ? 0 : setInterval(() => heroNext(), (hero.colorChangeSeconds || 3.2) * 1000);
$(".hero").addEventListener("click", (e) => {
  if (e.target.closest("a,button")) return;
  const r = e.currentTarget.getBoundingClientRect();
  heroNext(e.clientX - r.left, e.clientY - r.top);
  clearInterval(heroTimer);
  if (!reducedMotion) heroTimer = setInterval(() => heroNext(), (hero.colorChangeSeconds || 3.2) * 1000);
});

/* ---------- Marquee ---------- */
const mq = ["PAINTINGS", "✦", "SKETCHBOOKS", "✦", "EXTRAS", "✦", artist.name.toUpperCase(), "★"].join("  ");
$(".marquee__track").textContent = `${mq}  ${mq}  ${mq}  ${mq}  `;

/* ---------- Lightbox ---------- */
const lb = $(".lightbox");
let lbList = [], lbIdx = 0;
function lbShow() {
  const it = lbList[lbIdx], media = $(".lb-media", lb);
  media.innerHTML = "";
  if (it.kind === "video") {
    const yt = it.src.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
    if (yt) {
      const f = el("iframe"); f.src = `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`;
      f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; media.append(f);
    } else {
      const v = el("video"); v.src = it.src; v.controls = true; v.autoplay = true; v.playsInline = true; media.append(v);
    }
  } else {
    const img = smartImg(it.src, { label: it.title, color: it.color, seed: it.src || it.title });
    img.loading = "eager"; media.append(img);
  }
  $(".lb-cap", lb).innerHTML = it.caption;
  const multi = lbList.length > 1;
  $$(".lb-nav", lb).forEach((b) => (b.hidden = !multi));
}
function openLightbox(list, i) {
  lbList = list; lbIdx = i; lbShow();
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add("open"));
}
function closeLightbox() {
  lb.classList.remove("open");
  setTimeout(() => { lb.hidden = true; $(".lb-media", lb).innerHTML = ""; }, 250);
}
$(".lb-close", lb).onclick = closeLightbox;
lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
$(".lb-prev", lb).onclick = () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; lbShow(); };
$(".lb-next", lb).onclick = () => { lbIdx = (lbIdx + 1) % lbList.length; lbShow(); };
addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft" && lbList.length > 1) $(".lb-prev", lb).click();
  if (e.key === "ArrowRight" && lbList.length > 1) $(".lb-next", lb).click();
});

/* ---------- Paintings: series tabs + Cover Flow ---------- */
const pSec = $(".paintings");
let series = 0, active = 0, cfItems = [];
const pBG = new SplashBG($(".splash-bg", pSec), paintings[0]?.color || PAL[0], INK);
const stage = $(".coverflow__stage");
const tabs = $(".series-tabs");

paintings.forEach((s, i) => {
  const b = el("button", "series-tab", `<i style="background:${esc(s.color)}"></i>${esc(s.title)}`);
  b.setAttribute("role", "tab");
  b.onclick = (e) => switchSeries(i, e);
  tabs.append(b);
});

function seriesItems(s) {
  return s.items.map((it) => ({
    kind: "image", src: it.image, title: it.title, color: s.color,
    caption: `<strong>${esc(it.title)}</strong><span>${[it.year, it.medium, it.size].filter(Boolean).map(esc).join(" · ")}</span>`,
  }));
}

function buildCoverflow() {
  const s = paintings[series];
  stage.innerHTML = "";
  cfItems = s.items.map((it, i) => {
    const card = el("button", "cf-item");
    card.setAttribute("aria-label", it.title);
    card.append(smartImg(it.image, { label: it.title, color: s.color === PAL[i % PAL.length] ? INK : PAL[(i + series + 1) % PAL.length], seed: s.id + i }));
    card.addEventListener("click", () => {
      if (cfDragged) return;
      if (i === active) openLightbox(seriesItems(s), i);
      else setActive(i);
    });
    stage.append(card);
    return card;
  });
  active = Math.min(active, cfItems.length - 1);
  layoutCoverflow(active);
  updateCaption();
}

function layoutCoverflow(pos) {
  const W = cfItems[0]?.offsetWidth || 260;
  cfItems.forEach((card, i) => {
    const d = i - pos, a = Math.abs(d), sg = Math.sign(d);
    const x = a < 1 ? d * W * 0.75 : sg * (W * 0.75 + (a - 1) * W * 0.3);
    const ry = -sg * Math.min(a, 1) * 62;
    const z = -Math.min(a, 1) * W * 0.55 + (a < 1 ? (1 - a) * 60 : 0);
    card.style.transform = `translate(-50%,-50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg)`;
    card.style.zIndex = 100 - Math.round(a * 10);
    card.style.opacity = a > 5.5 ? 0 : 1;
    card.classList.toggle("is-active", Math.round(pos) === i);
  });
}

function updateCaption() {
  const it = paintings[series]?.items[active];
  if (!it) return;
  $(".cf-caption__text strong").textContent = it.title;
  $(".cf-caption__text span").textContent = [it.year, it.medium, it.size].filter(Boolean).join(" · ");
}

function setActive(i) {
  const n = clamp(i, 0, cfItems.length - 1);
  if (n !== active) blip(900 + n * 40, 0.03);
  active = n; layoutCoverflow(active); updateCaption();
}

function paintSeriesText() {
  const s = paintings[series];
  pSec.style.setProperty("--sec-ink", s.ink || contrastOn(s.color, INK, PAPER));
  $(".series-info__title").textContent = s.title;
  $(".series-info__blurb").textContent = s.blurb || "";
  $$(".series-tab").forEach((t, i) => t.classList.toggle("on", i === series));
}

function switchSeries(i, e) {
  if (i === series) return;
  const r = pSec.getBoundingClientRect();
  pBG.to(paintings[i].color, e ? e.clientX - r.left : r.width / 2, e ? e.clientY - r.top : r.height / 2, 850);
  stage.classList.add("out");
  setTimeout(() => {
    series = i; active = 0;
    paintSeriesText(); buildCoverflow();
    stage.classList.remove("out"); stage.classList.add("in");
    setTimeout(() => stage.classList.remove("in"), 600);
  }, 380);
}

// drag / swipe / wheel / keys
let cfDragged = false;
{
  const cf = $(".coverflow");
  let x0 = 0, start = 0, down = false;
  cf.addEventListener("pointerdown", (e) => { down = true; cfDragged = false; x0 = e.clientX; start = active; });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 6 && !cfDragged) { cfDragged = true; stage.classList.add("dragging"); }
    if (cfDragged) layoutCoverflow(clamp(start - dx / ((cfItems[0]?.offsetWidth || 260) * 0.45), -0.4, cfItems.length - 0.6));
  });
  addEventListener("pointerup", (e) => {
    if (!down) return; down = false;
    stage.classList.remove("dragging");
    if (cfDragged) {
      setActive(Math.round(start - (e.clientX - x0) / ((cfItems[0]?.offsetWidth || 260) * 0.45)));
      setTimeout(() => (cfDragged = false), 0);
    }
  });
  let wheelAcc = 0;
  cf.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault(); wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 60) { setActive(active + Math.sign(wheelAcc)); wheelAcc = 0; }
  }, { passive: false });
  cf.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") setActive(active - 1);
    if (e.key === "ArrowRight") setActive(active + 1);
    if (e.key === "Enter") openLightbox(seriesItems(paintings[series]), active);
  });
  $$(".cf-arrow").forEach((b) => (b.onclick = () => setActive(active + +b.dataset.dir)));
  addEventListener("resize", () => layoutCoverflow(active));
}
if (paintings.length) { paintSeriesText(); buildCoverflow(); $$(".series-tab")[0].classList.add("on"); }
if (paintings.length < 2) tabs.hidden = true;

/* ---------- Sketchbooks (3D, loaded when close to view) ---------- */
const list = $(".shelf__list");
sketchbooks.forEach((b) => {
  const li = el("li");
  const btn = el("button", "chip", `<i style="background:${esc(b.color)}"></i>${esc(b.title)}`);
  btn.onclick = () => openBook(b.id);
  li.append(btn); list.append(li);
});
let shelfLoad = null;
function loadShelf() {
  shelfLoad ??= import("./sketchbooks.js").then((mod) => {
    mod.initShelf({ books: sketchbooks, theme, canvas: $(".shelf__canvas"), label: $(".shelf__label"), onOpen: openBook });
    return mod;
  }).catch((err) => {
    console.warn("3D sketchbooks unavailable:", err);
    $(".shelf").classList.add("no3d");
    return null;
  });
  return shelfLoad;
}
new IntersectionObserver((es) => es[0].isIntersecting && loadShelf(), { rootMargin: "800px" }).observe($(".sketchbooks"));

async function openBook(id, page = 0) {
  const book = sketchbooks.find((b) => b.id === id);
  if (!book) return;
  const mod = await loadShelf();
  if (!mod) return;
  await splashTransition({ color: book.color, ink: INK, onCovered: () => mod.openViewer(book, page) });
}

/* ---------- Extras ---------- */
const grid = $(".extras__grid");
const ICON = { image: "◉", video: "▶", link: "↗", text: "✎" };
const extraMedia = extras.filter((x) => x.type === "image" || x.type === "video");
extras.forEach((x, i) => {
  const color = PAL[i % PAL.length];
  const card = el(x.type === "text" ? "div" : "button", `x-card x-card--${x.type}`);
  card.style.setProperty("--card", color);
  card.style.setProperty("--tilt", `${((i * 37) % 7) - 3}deg`);
  if (x.type === "text") {
    card.innerHTML = `<span class="x-badge">${ICON.text}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>`;
  } else {
    if (x.image || x.type === "image") {
      const m = el("div", "x-media"); m.append(smartImg(x.image, { label: x.title, color, seed: "x" + i, kind: "extra" })); card.append(m);
    } else {
      card.append(el("div", "x-media x-media--glyph", `<span>${ICON[x.type] || "★"}</span>`));
    }
    card.insertAdjacentHTML("beforeend", `<span class="x-badge">${ICON[x.type] || "★"}</span><h3>${esc(x.title)}</h3>${x.caption ? `<p>${esc(x.caption)}</p>` : ""}`);
    card.onclick = () => {
      if (x.type === "link") return window.open(x.url, x.url.startsWith("mailto:") ? "_self" : "_blank", "noopener");
      const items = extraMedia.map((m, j) => ({
        kind: m.type === "video" ? "video" : "image", src: m.type === "video" ? m.url : m.image, title: m.title,
        color: PAL[extras.indexOf(m) % PAL.length], caption: `<strong>${esc(m.title)}</strong><span>${esc(m.caption || "")}</span>`,
      }));
      openLightbox(items, extraMedia.indexOf(x));
    };
  }
  card.classList.add("reveal");
  grid.append(card);
});

/* ---------- Section navigation with splash transitions ---------- */
const SECTIONS = [
  { id: "home", label: "Home", color: () => PAL[heroIdx] },
  { id: "paintings", label: "Paintings", color: () => paintings[series]?.color || PAL[0] },
  { id: "sketchbooks", label: "Sketchbooks", color: () => INK, ink: () => PAL[1] },
  { id: "extras", label: "Extras", color: () => PAPER },
  { id: "contact", label: "Contact", color: () => PAL[1 % PAL.length] },
];
function goTo(id, x, y) {
  const s = SECTIONS.find((s) => s.id === id);
  const target = document.getElementById(id);
  if (!s || !target) return;
  history.replaceState(null, "", "#" + id);
  splashTransition({ color: s.color(), ink: s.ink ? s.ink() : INK, x, y, onCovered: () => target.scrollIntoView({ behavior: "instant" }) });
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-nav]");
  if (!a) return;
  e.preventDefault();
  goTo(a.dataset.nav, e.clientX, e.clientY);
});

/* ---------- iPod menu ---------- */
const ipod = $(".ipod"), ipList = $(".ipod__list");
let ipIdx = 0, wheelMoved = false;
SECTIONS.forEach((s) => ipList.append(el("li", "", `<span>${s.label}</span><b>›</b>`)));
const ipItems = $$("li", ipList);
ipItems.forEach((li, i) => (li.onclick = () => { ipIdx = i; ipRender(); ipSelect(); }));
function ipRender() { ipItems.forEach((li, i) => li.classList.toggle("on", i === ipIdx)); }
function ipMove(d) { const n = clamp(ipIdx + d, 0, ipItems.length - 1); if (n !== ipIdx) { ipIdx = n; blip(1800, 0.012); ipRender(); } }
function ipOpen() {
  const here = SECTIONS.findIndex((s) => { const r = document.getElementById(s.id).getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom > innerHeight / 2; });
  ipIdx = Math.max(0, here); ipRender();
  ipod.hidden = false; requestAnimationFrame(() => ipod.classList.add("open"));
}
function ipClose() { ipod.classList.remove("open"); setTimeout(() => (ipod.hidden = true), 300); }
function ipSelect() { const r = $(".wheel__center").getBoundingClientRect(); ipClose(); goTo(SECTIONS[ipIdx].id, r.x + r.width / 2, r.y + r.height / 2); }
$(".ipod-btn").onclick = ipOpen;
ipod.addEventListener("click", (e) => { if (e.target === ipod) ipClose(); });
{
  const wheel = $(".wheel");
  let last = null, acc = 0;
  const ang = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - r.y - r.height / 2, e.clientX - r.x - r.width / 2); };
  wheel.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("wheel__center")) return;
    last = ang(e); acc = 0; wheelMoved = false; wheel.setPointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (last == null) return;
    const a = ang(e); let d = a - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    last = a; acc += d;
    if (Math.abs(acc) > 0.4) { wheelMoved = true; ipMove(Math.sign(acc)); acc = 0; }
  });
  wheel.addEventListener("pointerup", () => (last = null));
  $$("[data-act]", wheel).forEach((b) => (b.onclick = () => {
    if (wheelMoved) return;
    ({ menu: ipClose, prev: () => ipMove(-1), next: () => ipMove(1), select: ipSelect })[b.dataset.act]();
  }));
}
addEventListener("keydown", (e) => {
  if (ipod.hidden) return;
  if (e.key === "Escape") ipClose();
  if (e.key === "ArrowDown") ipMove(1);
  if (e.key === "ArrowUp") ipMove(-1);
  if (e.key === "Enter") ipSelect();
});

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.15 });
$$(".sec-title, .series-info, .sec-sub, .contact__big, .reveal").forEach((n) => { n.classList.add("reveal"); io.observe(n); });

/* ---------- Deep links: #sketchbook/<id> opens that book ---------- */
const m = location.hash.match(/^#sketchbook\/([\w-]+)(?:\/(\d+))?/);
if (m) { document.getElementById("sketchbooks").scrollIntoView(); openBook(m[1], +m[2] || 0); }
