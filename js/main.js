import content from "../content.js";
import { $, $$, el, esc, clamp, smartImg, contrastOn, reducedMotion } from "./util.js";
import { SplashBG, splashTransition } from "./splash.js";
import { startDancer } from "./dancer.js";
import { blip, flowTick } from "./sound.js";
import { initMusic } from "./music.js";
import { initGlitch } from "./glitch.js";
import { startViz } from "./viz.js";
import { getAnalyser } from "./sound.js";
import { sortPosts } from "./social-sort.js";
import { makeFlow } from "./flow.js";
import { frame, FRAMES, ensureInk, jellyOnView } from "./frames.js";

const { artist, theme, hero, paintings = [], sketchbooks = [], extras = [], social = {} } = content;
const INK = theme.ink, PAPER = theme.paper, PAL = theme.palette;

/* ---------- Social feed (written daily by the GitHub Action) ---------- */
const feed = await fetch("social/feed.json", { credentials: "same-origin", mode: "cors" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const buckets = sortPosts(feed?.posts || [], social.sort || [], { hide: social.hide || [], keep: social.keep || [] }).filter((b) => b.posts.length);
const tagLine = (p, n = 3) => (p.tags || []).slice(0, n).map((t) => "#" + t).join(" ");
const platformName = (p) => (p.platform === "instagram" ? "Instagram" : "TikTok");
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }); } catch { return ""; } };
function embedSrc(p, autoplay = false) {
  if (p.platform === "tiktok") return `https://www.tiktok.com/player/v1/${p.id}?description=1&music_info=1&rel=0${autoplay ? "&autoplay=1" : ""}`;
  const m = p.url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/` : null;
}
const postLink = (p) => `<a class="lb-link" href="${esc(p.url)}" target="_blank" rel="noopener">${p.platform === "instagram" ? "View on Instagram" : "Watch on TikTok"} ↗</a>`;
// Instagram videos play from the file itself (Instagram's embed often won't play them)
const postLightbox = (posts, color) => posts.map((p) => ({
  kind: p.videoUrl ? "video" : "embed", post: p, src: p.videoUrl || p.image, poster: p.image, title: p.title, color,
  caption: `<strong>${esc(p.title || "Untitled")}</strong><span>${esc([fmtDate(p.date), tagLine(p, 6)].filter(Boolean).join(" · "))}</span>${postLink(p)}`,
}));

/* ---------- Theme + text ---------- */
const root = document.documentElement.style;
root.setProperty("--ink", INK);
root.setProperty("--paper", PAPER);
PAL.forEach((c, i) => root.setProperty(`--c${i}`, c));
document.title = artist.name;
$(".logo").textContent = artist.name;
$(".hero__name").textContent = artist.name;
$(".hero__tagline").textContent = artist.tagline;
$(".contact__bio").textContent = artist.bio;
$(".contact__email").textContent = artist.email;
$(".contact__email").href = `mailto:${artist.email}`;
$(".contact__name").textContent = artist.slogan ? `${artist.name} — ${artist.slogan}` : artist.name;
$(".contact__slogan").textContent = artist.slogan || "";
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
const viz = startViz($(".hero__viz"), { ink: INK, state: () => ({ analyser: getAnalyser(), playing: !!music?.isPlaying?.() }) });
const dancer = startDancer($(".hero__dancer"), { ink: INK, image: hero.silhouetteImage, onBox: (b) => viz.place(b) });
const wordEl = $(".hero__words span");
wordEl.textContent = hero.words[0];
function heroNext(x, y) {
  heroIdx = (heroIdx + 1) % PAL.length;
  heroBG.to(PAL[heroIdx], x, y);
  setTimeout(() => {
    dancer.nextStyle();
    wordEl.classList.remove("pop"); void wordEl.offsetWidth;
    wordIdx = (wordIdx + 1) % hero.words.length;
    setWord(wordIdx);
    wordEl.classList.add("pop");
  }, 260);
}
let wordIdx = 0;
// each rotating word sits on its own colour frame
function setWord(i) {
  const [bg, fg] = FRAMES[(i * 5 + 3) % FRAMES.length];
  wordEl.textContent = hero.words[i];
  wordEl.classList.add("framed-word");
  wordEl.style.background = bg; wordEl.style.color = fg;
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
const mq = [...(content.work || []).flatMap((w) => [w.title.toUpperCase(), "✦"]), "SKETCHBOOKS", "✦", "EXTRAS", "✦", artist.name.toUpperCase(), "★", ...(artist.slogan ? [artist.slogan.toUpperCase(), "★"] : [])].join("  ");
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
      const v = el("video"); v.src = it.src; v.controls = true; v.autoplay = true; v.playsInline = true;
      if (it.poster) v.poster = it.poster;
      // link expired / blocked: fall back to Instagram's own player
      v.onerror = () => { if (it.post && embedSrc(it.post)) { const f = el("iframe", `lb-embed lb-embed--${it.post.platform}`); f.src = embedSrc(it.post, true); f.allowFullscreen = true; v.replaceWith(f); } };
      media.append(v);
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
  document.body.classList.add("no-scroll");                     // the page behind stays put
}
function closeLightbox() {
  music?.hold(false);
  lb.classList.remove("open");
  if ($(".viewer")?.hidden !== false) document.body.classList.remove("no-scroll");
  setTimeout(() => { lb.hidden = true; $(".lb-media", lb).innerHTML = ""; }, 250);
}
$(".lb-close", lb).onclick = closeLightbox;
lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
lb.addEventListener("wheel", (e) => { if (!e.target.closest(".lb-poem")) e.preventDefault(); }, { passive: false });   // no scrolling the page behind
$(".lb-prev", lb).onclick = () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; lbShow(); };
$(".lb-next", lb).onclick = () => { lbIdx = (lbIdx + 1) % lbList.length; lbShow(); };
addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft" && lbList.length > 1) $(".lb-prev", lb).click();
  if (e.key === "ArrowRight" && lbList.length > 1) $(".lb-next", lb).click();
});

/* ---------- Work: one Cover Flow per skill (content.js → work) ----------
   Each section pulls from feed sections (from: [...ids]) and/or the hand-made
   series in content.js → paintings (paintings: true). One card per piece:
   duplicates (Instagram often has a video + a photo of the same piece) are
   dropped, and multi-photo posts open as a swipeable set in the full-screen view. */
const work = content.work || [];
const keyOf = (p) => (p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "") || p.id;
function postPiece(p) {
  const imgs = (p.images?.length ? p.images : [p.art || p.image]).filter(Boolean);
  return { title: p.title || "Untitled", meta: [p.date?.slice(0, 4), p.platform === "instagram" ? "Instagram" : "TikTok"].filter(Boolean).join(" · "),
    image: p.art || imgs[0], images: p.art ? [p.art] : imgs, post: p, date: p.date || "" };
}
// Each post goes to the FIRST Work section whose tags match (content.js → work order),
// or to the section named in its "section" field (feed.json, kept across syncs).
// TikToks only count when the sync saved a picture of the finished piece (p.art) —
// their covers are title cards. Pictures only; videos live in Videos.
const allVisible = sortPosts(feed?.posts || [], [{ id: "all", match: "*" }], { hide: social.hide || [], keep: social.keep || [] })[0]?.posts || [];
const workOf = new Map();
for (const p of allVisible) {
  const tags = new Set((p.tags || []).map((t) => t.toLowerCase()));
  if (p.section === "none") continue;
  // sketchbook pages/timelapses live in the Sketchbooks section, not Work (unless the post is also canvas etc.)
  const sk = content.workSkip || {};
  if (!p.section && (sk.tags || []).some((t) => tags.has(t)) && !(sk.unless || []).some((t) => tags.has(t))) continue;
  if (!tags.has("poetry") && (p.platform === "tiktok" ? !p.art : !(p.image || p.images?.length) || p.video)) continue;
  const w = work.find((w) => w.id === p.section) || work.find((w) => (w.match || []).some((m) => tags.has(m)));
  if (w) workOf.set(p, w.id);
}
function workPieces(w) {
  const out = [], seen = new Set();
  if (w.paintings) for (const s of paintings) for (const it of s.items) {
    out.push({ title: it.title, meta: [it.year, it.medium, it.size].filter(Boolean).join(" · "), image: it.image, images: [it.image], item: it, date: String(it.year || "") + "-99" });
    seen.add((it.title || "").toLowerCase().replace(/[^a-z0-9]+/g, ""));
  }
  const posts = allVisible.filter((p) => workOf.get(p) === w.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  for (const p of posts) {
    const k = keyOf(p); if (seen.has(k)) continue; seen.add(k);
    const pc = postPiece(p);
    // expandYears: in these years, every photo of a multi-photo post gets its own card
    if ((w.expandAll || (w.expandYears || []).includes(pc.date.slice(0, 4))) && pc.images.length > 1)
      pc.images.forEach((src, i) => out.push({ ...pc, image: src, images: [src], meta: `${pc.meta} · ${i + 1}/${pc.images.length}` }));
    else out.push(pc);
  }
  return out;
}
function slidesFor(w, pieces) {
  const slides = [], first = [];
  pieces.forEach((pc) => {
    first.push(slides.length);
    pc.images.forEach((src, k) => {
      const p = pc.post, n = pc.images.length;
      const text = "";
      const play = p && (p.platform === "tiktok" || p.video) && !p.art && embedSrc(p);   // a video piece plays in place
      slides.push({ kind: play ? (p.videoUrl ? "video" : "embed") : "image", post: p, src: play && p.videoUrl ? p.videoUrl : src, poster: src, title: pc.title, color: w.color,
        caption: `<strong>${esc(pc.title)}</strong><span>${esc(pc.meta)}${n > 1 ? ` · photo ${k + 1} of ${n}` : ""}</span>` +
          (pc.item?.note ? `<em class="lb-note">${esc(pc.item.note)}</em>` : "") + text +
          (p ? postLink(p) : pc.item?.link ? `<a class="lb-link" href="${esc(pc.item.link)}" target="_blank" rel="noopener">${/tiktok/.test(pc.item.link) ? "Watch on TikTok" : "View on Instagram"} ↗</a>` : "") });
    });
  });
  return { slides, first };
}
const workList = $(".work__list"), workNav = $(".work-nav");
const workSecs = [], workKeys = new Set();
const shown = (content.workOrder || work.map((w) => w.id)).map((id) => work.find((w) => w.id === id)).filter(Boolean);
for (const w of shown) {
  const pieces = workPieces(w);
  pieces.forEach((pc) => pc.post && workKeys.add(keyOf(pc.post)));
  if (!pieces.length) continue;
  // one year at a time: the carousel only builds that year's cards (keeps the page light)
  const years = [...new Set(pieces.map((pc) => pc.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort((a, b) => b - a);
  const sec = el("section", "wsec");
  sec.id = "work-" + w.id;
  sec.style.setProperty("--wbg", w.color); sec.style.setProperty("--sec-ink", contrastOn(w.color, INK, PAPER));
  sec.innerHTML = `<div class="wsec__head"><h3 class="wsec__title">${esc(w.title)}</h3><p class="wsec__blurb">${esc(w.blurb || "")} <b>${pieces.length} pieces</b></p></div>
    <div class="wsec__years" role="tablist" aria-label="${esc(w.title)} by year"></div><div class="wsec__flow"></div>`;
  workList.append(sec);
  const yBox = $(".wsec__years", sec), flowRoot = $(".wsec__flow", sec);
  let flow = null;
  const show = (y) => {
    const list = pieces.filter((pc) => pc.date.startsWith(y));
    const { slides, first } = slidesFor(w, list);
    flow?.destroy();
    flow = makeFlow(flowRoot, list, { seed: w.id + y, tint: (i) => PAL[(i + 1) % PAL.length], onOpen: (i) => openLightbox(slides, first[i]) });
    $$("button", yBox).forEach((b) => b.classList.toggle("on", b.dataset.y === y));
  };
  for (const y of years) {
    const n = pieces.filter((pc) => pc.date.startsWith(y)).length;
    const b = el("button", "wyear", `${y} <small>${n}</small>`); b.dataset.y = y; b.setAttribute("role", "tab");
    b.onclick = () => { if (!b.classList.contains("on")) { flowRoot.classList.add("out"); setTimeout(() => { show(y); flowRoot.classList.remove("out"); }, 180); } };
    yBox.append(b);
  }
  if (years.length < 2) yBox.hidden = true;
  // build the carousel only when the section comes near the screen
  // start on the newest year that has a decent handful of pieces
  const cnt = (y) => pieces.filter((pc) => pc.date.startsWith(y)).length;
  const start = years.find((y) => cnt(y) >= 6) || years.reduce((a, b) => (cnt(b) > cnt(a) ? b : a), years[0]);
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); show(start); } }, { rootMargin: "600px" }).observe(sec);
  const chip = el("a", "series-tab", `<i style="background:${esc(w.color)}"></i>${esc(w.title)}`);
  chip.href = "#" + sec.id;
  chip.onclick = (e) => { e.preventDefault(); sec.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" }); };
  workNav.append(chip);
  workSecs.push({ w, sec });
}

/* ---------- Videos: posts sorted into tabs by hashtag ---------- */
const vSec = $(".videos");
const vBuckets = buckets.filter((b) => b.videos !== false)
  // videos only; an Instagram video of a piece already shown in Work is a repeat, so it's left out
  .map((b) => ({ ...b, posts: b.posts.filter((p) => p.platform === "tiktok" || (p.video && !workKeys.has(keyOf(p)))) })).filter((b) => b.posts.length);
if (!vBuckets.length) { vSec.hidden = true; $$('[data-nav="videos"]').forEach((a) => (a.hidden = true)); }
else {
  let vb = 0;
  const vBG = new SplashBG($(".splash-bg", vSec), vBuckets[0].color || PAL[0], INK);
  const vTabs = $(".video-tabs"), row = $(".vrow");
  vBuckets.forEach((b, i) => {
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
    const b = vBuckets[vb];
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
  if (book.nsfw && !(await ageGate(book))) { if (location.hash.startsWith("#sketchbook/")) history.replaceState(null, "", "#sketchbooks"); return; }
  const mod = await loadShelf();
  if (!mod) return;
  const shelf = mod.getShelf?.();
  if (shelf?.canZoom() && !+page) {
    // fly the desk camera into the book, and fade the page-turner in over it
    const fx = shelf.zoomTo(id);
    mod.openViewer(book, 0, { fadeAfter: fx.near });
    return;
  }
  await splashTransition({ color: book.color, ink: INK, onCovered: () => mod.openViewer(book, page) });
}

/* ---------- NSFW books: a quick "what year were you born?" ---------- */
const AGE_KEY = "fbs-18plus";
function ageGate(book) {
  try { if (localStorage.getItem(AGE_KEY) === "1") return Promise.resolve(true); } catch {}
  return new Promise((resolve) => {
    const now = new Date().getFullYear();
    const box = el("div", "agegate", `
      <form class="agegate__card" style="--book:${esc(book.color)}">
        <p class="agegate__tag">⚠ NSFW</p>
        <h3 class="agegate__title">${esc(book.title)} has adult art in it</h3>
        <label class="agegate__q" for="agegate-year">What year were you born?</label>
        <input id="agegate-year" class="agegate__in" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="YYYY" autocomplete="bday-year" />
        <p class="agegate__msg" aria-live="polite"></p>
        <div class="agegate__btns">
          <button type="button" class="agegate__no">nope, back</button>
          <button type="submit" class="agegate__yes">open it</button>
        </div>
      </form>`);
    document.body.append(box);
    const input = $(".agegate__in", box), msg = $(".agegate__msg", box);
    requestAnimationFrame(() => { box.classList.add("is-in"); input.focus(); });
    const done = (ok) => {
      box.classList.remove("is-in");
      setTimeout(() => box.remove(), 250);
      removeEventListener("keydown", esc_);
      resolve(ok);
    };
    const esc_ = (e) => { if (e.key === "Escape") done(false); };
    addEventListener("keydown", esc_);
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 4); msg.textContent = ""; });
    $(".agegate__no", box).onclick = () => done(false);
    box.addEventListener("click", (e) => { if (e.target === box) done(false); });
    $("form", box).onsubmit = (e) => {
      e.preventDefault();
      const y = +input.value;
      if (input.value.length !== 4 || y < now - 120 || y > now) { msg.textContent = "four digits, like 1999"; return; }
      if (now - y < 18) { msg.textContent = "come back in a few years ✌"; input.value = ""; return; }
      try { localStorage.setItem(AGE_KEY, "1"); } catch {}
      done(true);
    };
  });
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
  { id: "sketchbooks", label: "Sketchbooks", color: () => INK, ink: () => PAL[1] },
  ...workSecs.map(({ w, sec }) => ({ id: sec.id, label: w.title, color: () => w.color })),
  ...(vBuckets.length ? [{ id: "videos", label: "Videos", color: () => vBuckets[0].color || PAL[0] }] : []),
  { id: "extras", label: "Extras", color: () => PAPER },
  { id: "contact", label: "Contact", color: () => PAL[1 % PAL.length] },
];
function goTo(id, x, y) {
  const s = SECTIONS.find((s) => s.id === id) || { color: () => work[0]?.color || PAL[0] };
  const target = document.getElementById(id);
  if (!target) return;
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
function ipRender() {
  ipItems.forEach((li, i) => li.classList.toggle("on", i === ipIdx));
  // the screen shows ~6 rows: scroll the list so the highlighted row stays on screen, like a real iPod
  const li = ipItems[ipIdx];
  if (li.offsetTop < ipList.scrollTop) ipList.scrollTop = li.offsetTop;
  else if (li.offsetTop + li.offsetHeight > ipList.scrollTop + ipList.clientHeight) ipList.scrollTop = li.offsetTop + li.offsetHeight - ipList.clientHeight;
  ipList.classList.toggle("more", ipList.scrollTop + ipList.clientHeight < ipList.scrollHeight - 2);
}
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
// One continuous flight: the mini iPod lifts off the corner and glides in
// toward you like a paper airplane — banking into a turn, swinging its nose
// round, then flaring and settling flat. Every frame is sampled from smooth
// curves that start and end at rest, and the last frame is the menu's exact
// resting style, so nothing pops at either end. Closing flies it back.
let ipAnims = [];
function ipMorph(open) {
  const btn = $(".ipod-btn"), body = $(".ipod__body");
  ipAnims.forEach((a) => a.cancel()); ipAnims = [];
  if (reducedMotion || !body.animate) { btn.classList.toggle("is-away", open); return Promise.resolve(); }

  const a = btn.getBoundingClientRect(), b = body.getBoundingClientRect();
  const sx0 = a.width / b.width, sy0 = a.height / b.height;
  const dx0 = a.left + a.width / 2 - (b.left + b.width / 2), dy0 = a.top + a.height / 2 - (b.top + b.height / 2);
  const W = innerWidth, H = innerHeight;

  // smooth helpers (zero speed at u = 0 and u = 1)
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);              // glide in / glide out
  const hump = (u) => Math.sin(Math.PI * u) ** 2;                       // 0 → 1 → 0, flat at both ends
  const L = (x, y, t) => x + (y - x) * t;
  // flight path: cubic Bézier from the corner to the centre, swinging wide
  // (pulled in on narrow screens so the whole glide stays on screen)
  const narrow = W < 600;
  const P0 = [dx0, dy0], P1 = [dx0 - W * (narrow ? 0.2 : 0.08), dy0 + H * 0.05], P2 = [-W * (narrow ? 0.09 : 0.32), H * (narrow ? 0.1 : 0.16)], P3 = [0, 0];
  const bez = (t, i) => (1 - t) ** 3 * P0[i] + 3 * (1 - t) ** 2 * t * P1[i] + 3 * (1 - t) * t * t * P2[i] + t ** 3 * P3[i];

  const N = 60, frames = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N, t = ease(u), h = hump(u);
    const x = bez(t, 0), y = bez(t, 1);
    const grow = ease(Math.min(1, u * 1.15));                          // reaches full size just before landing
    const pop = narrow ? 0.03 : 0.06;
    const sx = L(sx0, 1, grow) + pop * h * u, sy = L(sy0, 1, grow) + pop * h * u;   // comes "at you", then settles
    const bank = (narrow ? 11 : 26) * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u);              // bank into the turn, then out
    const yaw = (narrow ? 22 : 34) * h * (1.15 - u);                                                    // nose swings round to face you
    const pitch = -16 * h * Math.cos(Math.PI * u * 1.3);                                // dips, then flares to land
    const lift = 70 * h * (1 - u);                                                      // height above the page → shadow
    const r = L(10, 34, grow);                                                          // corner radius in screen px
    frames.push({
      transform: `perspective(${narrow ? 1700 : 1100}px) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateZ(${bank.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
      borderRadius: `${(r / sx).toFixed(2)}px / ${(r / sy).toFixed(2)}px`,
      boxShadow: `0 ${(L(4, 30, grow) + lift * 0.5).toFixed(1)}px ${(L(14, 60, grow) + lift).toFixed(1)}px rgba(0,0,0,${(L(0.22, 0.35, grow) - 0.08 * h).toFixed(3)}), inset 0 0 0 1px rgba(0,0,0,.07), inset 0 -3px 8px rgba(0,0,0,.05)`,
    });
  }
  // land exactly on the resting style so the hand-off to CSS is invisible
  const rest = getComputedStyle(body);
  frames[N].boxShadow = rest.boxShadow; frames[N].borderRadius = rest.borderRadius;

  const opts = open ? { duration: 980, easing: "linear", fill: "both" }
                    : { duration: 700, easing: "linear", fill: "both", direction: "reverse" };
  btn.classList.add("is-away");                                        // the mini one *becomes* the big one
  const main = body.animate(frames, opts);
  // details fade in during the last part of the flight (out first when closing)
  const fade = [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }];
  const inner = $$(".ipod__bar, .ipod__list, .wheel__lbl, .wheel__center", body);
  ipAnims = [main,
    ...inner.map((n) => n.animate(fade, { ...opts, easing: "ease-in-out" })),
    $(".ipod__screen", body).animate([{ backgroundColor: "#7fb2ff" }, { backgroundColor: "#7fb2ff", offset: 0.45 }, { backgroundColor: "#f4f8ff" }], { ...opts, easing: "ease-in-out" }),
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

/* ---------- Text-frame titling on the flashy headings ---------- */
frame($(".hero__name"), { lines: artist.name.split(/\s+/), seed: "hero" });
$$(".sec-title").forEach((h) => frame(h));
$$(".wsec__title").forEach((h) => frame(h, { indent: 0 }));
frame($(".contact__big"), { seed: "hi" });
ensureInk(); setWord(0);
jellyOnView($$(".framed"));

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.15 });
$$(".sec-title, .wsec__head, .sec-sub, .contact__big, .reveal").forEach((n) => { n.classList.add("reveal"); io.observe(n); });

/* ---------- Deep links: #sketchbook/<id> opens that book ---------- */
const m = location.hash.match(/^#sketchbook\/([\w-]+)(?:\/(\d+))?/);
if (m) { document.getElementById("sketchbooks").scrollIntoView(); openBook(m[1], +m[2] || 0); }

/* ---------- Glitch overlay: bitmap collage from free stock + your own art ---------- */
glitch = initGlitch(content.glitch, {
  palette: PAL, ink: INK,
  local: [...new Set(buckets.flatMap((b) => b.posts).map((p) => p.art || p.image).filter(Boolean))],
});
