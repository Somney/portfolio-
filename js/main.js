import content from "../content.js";
import { $, $$, el, esc, clamp, smartImg, contrastOn, reducedMotion } from "./util.js";
import { SplashBG, splashTransition } from "./splash.js";
import { startDancer } from "./dancer.js";
import { blip, flowTick } from "./sound.js";
import { initMusic } from "./music.js";
import { initGlitch } from "./glitch.js";
import { sortPosts } from "./social-sort.js";

const { artist, theme, hero, paintings = [], sketchbooks = [], extras = [], social = {} } = content;
const INK = theme.ink, PAPER = theme.paper, PAL = theme.palette;

/* ---------- Social feed (written daily by the GitHub Action) ---------- */
const feed = await fetch("social/feed.json", { credentials: "same-origin", mode: "cors" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const buckets = sortPosts(feed?.posts || [], social.sort || [], { hide: social.hide || [] }).filter((b) => b.posts.length);
const tagLine = (p, n = 3) => (p.tags || []).slice(0, n).map((t) => "#" + t).join(" ");
const platformName = (p) => (p.platform === "instagram" ? "Instagram" : "TikTok");
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }); } catch { return ""; } };
function embedSrc(p, autoplay = false) {
  if (p.platform === "tiktok") return `https://www.tiktok.com/player/v1/${p.id}?description=1&music_info=1&rel=0${autoplay ? "&autoplay=1" : ""}`;
  const m = p.url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/` : null;
}
const postLink = (p) => `<a class="lb-link" href="${esc(p.url)}" target="_blank" rel="noopener">${p.platform === "instagram" ? "View on Instagram" : "Watch on TikTok"} ↗</a>`;
const postLightbox = (posts, color) => posts.map((p) => ({
  kind: "embed", post: p, src: p.image, title: p.title, color,
  caption: `<strong>${esc(p.title || "Untitled")}</strong><span>${esc([fmtDate(p.date), tagLine(p, 6)].filter(Boolean).join(" · "))}</span>${postLink(p)}`,
}));

// newest covers from sections marked inPaintings → a paintings series
const fresh = buckets.filter((b) => b.inPaintings).flatMap((b) => b.posts).filter((p) => p.art || p.image)
  .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 24);
if (fresh.length) paintings.unshift({
  id: "feed", title: "Fresh from the feed", color: PAL[3] || "#ff8a00", ink: INK,
  blurb: `My latest pieces, pulled straight from ${[social.tiktok && "TikTok", feed?.posts?.some((p) => p.platform === "instagram") && "Instagram"].filter(Boolean).join(" & ")} and sorted by hashtag.`,
  items: fresh.map((p) => ({ title: p.title || "Untitled", year: p.date?.slice(0, 4), medium: tagLine(p), image: p.art || p.image, post: p })),
});

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

let glitch = { burst() {} };   // set up at the end, once the page is built

/* ---------- Smooth scrolling: full-screen overlays step aside while you scroll ---------- */
{
  let t = 0; const root = document.documentElement;
  addEventListener("scroll", () => {
    if (!t) root.classList.add("is-scrolling");
    clearTimeout(t); t = setTimeout(() => { root.classList.remove("is-scrolling"); t = 0; }, 160);
  }, { passive: true });
}

/* ---------- Background music (YouTube, starts on first tap) ---------- */
const music = initMusic(content.music);

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
  if (it.kind === "embed" && embedSrc(it.post)) {
    const f = el("iframe", `lb-embed lb-embed--${it.post.platform}`);
    f.src = embedSrc(it.post, true); f.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture"; f.allowFullscreen = true;
    f.title = it.title || "Post"; media.append(f);
  } else if (it.kind === "video") {
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
  if (list[i]?.kind === "embed" || list[i]?.kind === "video") music?.hold(true);
  lbList = list; lbIdx = i; lbShow();
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add("open"));
}
function closeLightbox() {
  music?.hold(false);
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
  if (s.id === "feed") return postLightbox(s.items.map((it) => it.post), s.color);
  return s.items.map((it) => ({
    kind: "image", src: it.image, title: it.title, color: s.color,
    caption: `<strong>${esc(it.title)}</strong><span>${[it.year, it.medium, it.size].filter(Boolean).map(esc).join(" · ")}</span>` +
      (it.link ? `<a class="lb-link" href="${esc(it.link)}" target="_blank" rel="noopener">${/tiktok/.test(it.link) ? "Watch on TikTok" : "View on Instagram"} ↗</a>` : ""),
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
  if (n !== active) flowTick(n);
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
  glitch.burst(1.6);
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
  let x0 = 0, start = 0, down = false, dragIdx = 0;
  cf.addEventListener("pointerdown", (e) => { down = true; cfDragged = false; x0 = e.clientX; start = active; dragIdx = active; });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 6 && !cfDragged) { cfDragged = true; stage.classList.add("dragging"); }
    if (cfDragged) {
      const pos = clamp(start - dx / ((cfItems[0]?.offsetWidth || 260) * 0.45), -0.4, cfItems.length - 0.6);
      const idx = Math.round(pos);
      if (idx !== dragIdx) { dragIdx = idx; flowTick(idx); }
      layoutCoverflow(pos);
    }
  });
  addEventListener("pointerup", (e) => {
    if (!down) return; down = false;
    stage.classList.remove("dragging");
    if (cfDragged) {
      const land = clamp(Math.round(start - (e.clientX - x0) / ((cfItems[0]?.offsetWidth || 260) * 0.45)), 0, cfItems.length - 1);
      if (land === dragIdx) { active = land; layoutCoverflow(active); updateCaption(); } else setActive(land);
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

/* ---------- Videos: posts sorted into tabs by hashtag ---------- */
const vSec = $(".videos");
if (!buckets.length) { vSec.hidden = true; $$('[data-nav="videos"]').forEach((a) => (a.hidden = true)); }
else {
  let vb = 0;
  const vBG = new SplashBG($(".splash-bg", vSec), buckets[0].color || PAL[0], INK);
  const vTabs = $(".video-tabs"), row = $(".vrow");
  buckets.forEach((b, i) => {
    const t = el("button", "series-tab", `<i style="background:${esc(b.color || PAL[i % PAL.length])}"></i>${esc(b.title)} <small>${b.posts.length}</small>`);
    t.onclick = (e) => {
      if (i === vb) return;
      const r = vSec.getBoundingClientRect();
      vBG.to(b.color || PAL[i % PAL.length], e.clientX - r.left, e.clientY - r.top, 850);
      row.classList.add("out");
      setTimeout(() => { vb = i; renderRow(); row.classList.remove("out"); }, 350);
    };
    vTabs.append(t);
  });
  function renderRow() {
    const b = buckets[vb];
    vSec.style.setProperty("--sec-ink", contrastOn(b.color || PAL[0], INK, PAPER));
    $$(".series-tab", vTabs).forEach((t, i) => t.classList.toggle("on", i === vb));
    row.innerHTML = ""; row.scrollLeft = 0;
    const lbItems = postLightbox(b.posts, b.color);
    b.posts.forEach((p, i) => {
      const c = el("button", "vcard");
      c.style.setProperty("--d", `${Math.min(i, 12) * 45}ms`);
      const img = el("div", "vcard__img");
      img.append(smartImg(p.image, { label: p.title || "", color: PAL[i % PAL.length], seed: p.id, kind: "extra" }));
      img.insertAdjacentHTML("beforeend", `<span class="vcard__play">${p.platform === "instagram" && !p.video ? "◎" : "▶"}</span>`);
      c.append(img);
      c.insertAdjacentHTML("beforeend", `<strong>${esc(p.title || "Untitled")}</strong><span class="vcard__meta">${esc([fmtDate(p.date), platformName(p)].filter(Boolean).join(" · "))}</span><span class="vcard__tags">${esc(tagLine(p))}</span>`);
      c.onclick = () => openLightbox(lbItems, i);
      row.append(c);
    });
  }
  renderRow();
  $(".videos__meta").textContent = feed?.updated ? `Auto-sorted by hashtag · synced ${new Date(feed.updated).toLocaleDateString()}` : "";
  $$(".vrow-arrow").forEach((a) => (a.onclick = () => row.scrollBy({ left: +a.dataset.dir * row.clientWidth * 0.8, behavior: "smooth" })));
}

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
  if (x.type === "feed") {
    // shortcut card: a random post from one of the sorted groups, new pick on every visit
    const pool = (buckets.find((b) => b.id === x.from)?.posts || []).filter((p) => p.art || p.image);
    if (!pool.length) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const card = el("button", "x-card x-card--feed reveal");
    card.style.setProperty("--card", color);
    card.style.setProperty("--tilt", `${((i * 37) % 7) - 3}deg`);
    const m = el("div", "x-media x-media--feed");
    m.append(smartImg(p.art || p.image, { label: p.title, color, seed: p.id, kind: "extra" }));
    m.insertAdjacentHTML("beforeend", `<span class="vcard__play">▶</span>`);
    card.append(m);
    card.insertAdjacentHTML("beforeend", `<span class="x-badge">▶</span><h3>${esc(x.title || p.title || "Timelapse")}</h3><p>${esc([p.title, fmtDate(p.date)].filter(Boolean).join(" · "))}</p>`);
    card.onclick = () => openLightbox(postLightbox([p], color), 0);
    grid.append(card);
    return;
  }
  const card = el(x.type === "text" || x.type === "tiktok" || x.type === "instagram" ? "div" : x.type === "link" ? "a" : "button", `x-card x-card--${x.type}`);
  if (x.type === "link") { card.href = x.url; if (!x.url.startsWith("mailto:")) { card.target = "_blank"; card.rel = "noopener"; } }
  card.style.setProperty("--card", color);
  card.style.setProperty("--tilt", `${((i * 37) % 7) - 3}deg`);
  if (x.type === "tiktok" || x.type === "instagram") {
    const frame = socialEmbed(x.url);
    card.innerHTML = `<span class="x-badge">${x.type === "tiktok" ? "♪" : "◎"}</span>`;
    if (frame) { const m = el("div", `x-embed x-embed--${x.type}`); m.append(frame); card.append(m); }
    card.insertAdjacentHTML("beforeend", `${x.title ? `<h3>${esc(x.title)}</h3>` : ""}<p><a href="${esc(x.url)}" target="_blank" rel="noopener">Open on ${x.type === "tiktok" ? "TikTok" : "Instagram"} ↗</a></p>`);
  } else if (x.type === "text") {
    card.innerHTML = `<span class="x-badge">${ICON.text}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>`;
  } else {
    if (x.image || x.type === "image") {
      const m = el("div", "x-media"); m.append(smartImg(x.image, { label: x.title, color, seed: "x" + i, kind: "extra" })); card.append(m);
    } else {
      card.append(el("div", "x-media x-media--glyph", `<span>${ICON[x.type] || "★"}</span>`));
    }
    card.insertAdjacentHTML("beforeend", `<span class="x-badge">${ICON[x.type] || "★"}</span><h3>${esc(x.title)}</h3>${x.caption ? `<p>${esc(x.caption)}</p>` : ""}`);
    card.onclick = () => {
      if (x.type === "link") return;
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

/* ---------- Social: post embeds + live TikTok feed ---------- */
function socialEmbed(url = "") {
  const tt = url.match(/tiktok\.com\/.*video\/(\d+)/);
  const ig = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
  if (!tt && !ig) return null;
  const f = el("iframe");
  f.src = tt ? `https://www.tiktok.com/player/v1/${tt[1]}?description=1&music_info=1&rel=0` : `https://www.instagram.com/${ig[1]}/${ig[2]}/embed/captioned/`;
  f.loading = "lazy"; f.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture"; f.allowFullscreen = true;
  f.title = tt ? "TikTok video" : "Instagram post";
  return f;
}
{
  const feeds = $(".feeds");
  const tt = (social.tiktok || "").replace(/^@/, ""), ig = (social.instagram || "").replace(/^@/, "");
  if (!tt && !ig) feeds.hidden = true;
  if (ig) {
    const a = el("a", "feed-card feed-card--ig", `<span class="feed-card__kicker">Instagram</span><strong>@${esc(ig)}</strong><span>New work, WIPs &amp; studio stuff</span><b>Follow ↗</b>`);
    a.href = `https://www.instagram.com/${encodeURIComponent(ig)}/`; a.target = "_blank"; a.rel = "noopener";
    feeds.append(a);
  }
  if (tt) {
    const box = el("div", "feed-card feed-card--tt");
    box.innerHTML = `<span class="feed-card__kicker">Latest on TikTok</span>
      <blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${esc(tt)}" data-unique-id="${esc(tt)}" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0">
        <section><a target="_blank" rel="noopener" href="https://www.tiktok.com/@${esc(tt)}?refer=creator_embed">@${esc(tt)}</a></section>
      </blockquote>`;
    feeds.prepend(box);
    // load TikTok's script only when the feed is close to view
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      const sc = document.createElement("script"); sc.async = true; sc.src = "https://www.tiktok.com/embed.js";
      document.body.append(sc);
    }, { rootMargin: "600px" }).observe(box);
  }
}

/* ---------- Section navigation with splash transitions ---------- */
const SECTIONS = [
  { id: "home", label: "Home", color: () => PAL[heroIdx] },
  { id: "paintings", label: "Paintings", color: () => paintings[series]?.color || PAL[0] },
  ...(buckets.length ? [{ id: "videos", label: "Videos", color: () => buckets[0].color || PAL[0] }] : []),
  { id: "sketchbooks", label: "Sketchbooks", color: () => INK, ink: () => PAL[1] },
  { id: "extras", label: "Extras", color: () => PAPER },
  { id: "contact", label: "Contact", color: () => PAL[1 % PAL.length] },
];
function goTo(id, x, y) {
  const s = SECTIONS.find((s) => s.id === id);
  const target = document.getElementById(id);
  if (!s || !target) return;
  history.replaceState(null, "", "#" + id);
  glitch.burst(2.2);
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
let ipIdx = 0;
SECTIONS.forEach((s) => ipList.append(el("li", "", `<span>${s.label}</span><b>›</b>`)));
const ipItems = $$("li", ipList);
ipItems.forEach((li, i) => (li.onclick = () => { ipIdx = i; ipRender(); ipSelect(); }));
function ipRender() { ipItems.forEach((li, i) => li.classList.toggle("on", i === ipIdx)); }
function ipMove(d) { const n = clamp(ipIdx + d, 0, ipItems.length - 1); if (n !== ipIdx) { ipIdx = n; blip(2000); ipRender(); } }
function ipOpen() {
  const here = SECTIONS.findIndex((s) => { const r = document.getElementById(s.id).getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom > innerHeight / 2; });
  ipIdx = Math.max(0, here); ipRender();
  ipod.hidden = false; requestAnimationFrame(() => ipod.classList.add("open"));
  ipMorph(true);
}
function ipClose() {
  if (ipod.hidden || ipod.dataset.closing) return;
  ipod.dataset.closing = "1";
  ipod.classList.remove("open");
  ipMorph(false).then(() => { ipod.hidden = true; delete ipod.dataset.closing; $(".ipod-btn").classList.remove("is-away"); });
}
// One continuous move: the mini iPod in the corner lifts off, swoops in on a
// curve and grows into the full menu (screen + wheel filling in on the way);
// closing flies it back into the corner.
let ipAnims = [];
function ipMorph(open) {
  const btn = $(".ipod-btn"), body = $(".ipod__body");
  ipAnims.forEach((a) => a.cancel()); ipAnims = [];
  if (reducedMotion || !body.animate) { btn.classList.toggle("is-away", open); return Promise.resolve(); }
  const a = btn.getBoundingClientRect(), b = body.getBoundingClientRect();
  const sx = a.width / b.width, sy = a.height / b.height;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const radius = (s) => `${10 / s}px / ${10 / s * (sx / sy)}px`;
  const frames = [
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)`, borderRadius: radius(sx), boxShadow: "0 4px 14px rgba(0,0,0,.22)", offset: 0 },
    // the swoop: drops down and out to the left of a straight line, tilting as it comes
    { transform: `translate(${dx * 0.42 - 34}px, ${dy * 0.32 + 46}px) scale(${0.55 + sx * 0.45}, ${0.55 + sy * 0.45}) rotate(-9deg)`, offset: 0.5 },
    { transform: "translate(0px, -6px) scale(1.02, 1.02) rotate(1.5deg)", offset: 0.82 },
    { transform: "translate(0px, 0px) scale(1, 1) rotate(0deg)", borderRadius: "34px", boxShadow: "0 30px 60px rgba(0,0,0,.35)", offset: 1 },
  ];
  const opts = open ? { duration: 620, easing: "cubic-bezier(.3,.7,.25,1)", fill: "both" } : { duration: 440, easing: "cubic-bezier(.55,0,.75,.3)", fill: "both", direction: "reverse" };
  btn.classList.add("is-away");                       // the mini one becomes the big one
  const main = body.animate(frames, opts);
  // screen + wheel details fade in late (out early when closing); the screen starts mini-blue
  const inner = $$(".ipod__bar, .ipod__list, .wheel__lbl, .wheel__center", body);
  const fade = [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 1 }];
  ipAnims = [main,
    ...inner.map((n) => n.animate(fade, { ...opts })),
    $(".ipod__screen", body).animate([{ backgroundColor: "#7fb2ff", offset: 0 }, { backgroundColor: "#7fb2ff", offset: 0.4 }, { backgroundColor: "#f4f8ff", offset: 1 }], { ...opts }),
  ];
  return main.finished.then(() => { if (open) ipAnims.forEach((x) => x.cancel()); }).catch(() => {});
}
function ipSelect() { const r = $(".wheel__center").getBoundingClientRect(); ipClose(); goTo(SECTIONS[ipIdx].id, r.x + r.width / 2, r.y + r.height / 2); }
$(".ipod-btn").onclick = ipOpen;
ipod.addEventListener("click", (e) => { if (e.target === ipod) ipClose(); });
{
  // One handler for the whole wheel: a tap fires the button under your
  // finger (MENU, ◀◀, ▶▶, ▶❚❚ or the centre); a circular drag scrolls.
  const wheel = $(".wheel");
  const ACT = { menu: ipClose, prev: () => ipMove(-1), next: () => ipMove(1), select: ipSelect };
  let last = null, acc = 0, moved = 0, downAct = null, pid = null;
  const ang = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - r.y - r.height / 2, e.clientX - r.x - r.width / 2); };
  wheel.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    downAct = e.target.closest("[data-act]")?.dataset.act || null;
    pid = e.pointerId; last = ang(e); acc = 0; moved = 0;
    // the centre button never spins
    if (e.target.closest(".wheel__center")) last = null;
  });
  wheel.addEventListener("pointermove", (e) => {
    if (last == null || e.pointerId !== pid) return;
    const a = ang(e); let d = a - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    last = a; acc += d; moved += Math.abs(d);
    if (moved > 0.25 && !wheel.hasPointerCapture(e.pointerId)) wheel.setPointerCapture(e.pointerId);
    if (Math.abs(acc) > 0.4) { ipMove(Math.sign(acc)); acc = 0; }
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    if (moved <= 0.25 && downAct && e.type === "pointerup") { blip(1600); ACT[downAct](); }
    last = null; downAct = null; pid = null;
  };
  wheel.addEventListener("pointerup", end);
  wheel.addEventListener("pointercancel", end);
  // keyboard: Enter/Space on a focused wheel button
  $$("[data-act]", wheel).forEach((b) => b.addEventListener("click", (e) => { if (e.detail === 0) ACT[b.dataset.act](); }));
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

/* ---------- Glitch overlay: bitmap collage from free stock + your own art ---------- */
glitch = initGlitch(content.glitch, {
  palette: PAL, ink: INK,
  local: [...new Set(buckets.flatMap((b) => b.posts).map((p) => p.art || p.image).filter(Boolean))],
});
