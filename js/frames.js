// "Text frame" titling, after notyourtype's commonSans Condensed badKern posts.
// What makes that look (studied from the posts):
//  • every letter has its own width: most are squeezed, a few (W, M, O, G…) blow wide
//  • some letters stand taller than their neighbours, all on one baseline
//  • kerning is "bad": letters run into each other and their strokes melt together
//  • stacked lines are stretched to the same width, each on its own flat colour block
//  • thin, even strokes that pool into soft blobs where they meet — a jelly feel
// The melting comes from an SVG "goo" filter (blur, then snap the edge back to crisp);
// the letter shapes come from per-letter stretching on top of a plain condensed font.
// frame(el, { lines, seed, caps, indent, justify })
import { seeded } from "./util.js";

export const FRAMES = [
  ["#0a8cff", "#0d0d0d"], ["#ff8cff", "#0d0d0d"], ["#58c95a", "#0d0d0d"], ["#6e5a12", "#0d0d0d"],
  ["#fff27a", "#0d0d0d"], ["#5b4513", "#ff1a1a"], ["#18ff20", "#ff1a1a"], ["#49a8ff", "#6e5a12"],
  ["#ffe600", "#0d2a24"], ["#2a1a1e", "#ff8cff"], ["#0aa0e0", "#0d0d0d"], ["#6e5a12", "#1f2bff"],
];

const WIDE = new Set("WMOGQCDwmo");          // letters that like to go wide
const TALL = new Set("ILTKHFEBRYAilthkdbf");  // stems that like to shoot up

function badCase(word, rnd) {
  return [...word].map((c, i) => {
    if (!/[a-z]/i.test(c)) return c;
    const base = i === 0 ? c.toUpperCase() : c.toLowerCase();
    return i > 0 && rnd() < 0.28 ? (base === base.toUpperCase() ? base.toLowerCase() : base.toUpperCase()) : base;
  }).join("");
}

// goo filters, one per size band (blur is in pixels, so big type needs more), plus a
// "live" one with animated warp used for a short jelly wobble on hover / first view
let inkReady = false;
export function ensureInk() {
  if (inkReady) return; inkReady = true;
  const goo = (id, freq, warp, blur, k, b, live = "") => `
    <filter id="${id}" x="-8%" y="-14%" width="116%" height="128%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="1" seed="11" result="flow">${live}</feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="flow" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="warped">${live ? `<animate attributeName="scale" values="${warp};${warp * 3.2};${warp * 1.4};${warp}" dur="1.6s" repeatCount="indefinite"/>` : ""}</feDisplacementMap>
      <feGaussianBlur in="warped" stdDeviation="${blur}" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${k} ${b}"/>
    </filter>`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    goo("gooL", "0.005 0.008", 4, 2.6, 24, -11) +
    goo("gooM", "0.008 0.012", 2.5, 1.6, 20, -9) +
    goo("gooS", "0.012 0.018", 1.2, 0.8, 16, -7) +
    goo("gooLive", "0.007 0.011", 4, 2, 22, -10, `<animate attributeName="baseFrequency" values="0.007 0.011;0.011 0.016;0.007 0.011" dur="1.6s" repeatCount="indefinite"/>`) +
    `<filter id="inkBlock" x="-3%" y="-6%" width="106%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="f"/><feDisplacementMap in="SourceGraphic" in2="f" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  document.body.prepend(svg);
}

const all = new Set();
export function frame(el, { lines, seed, caps = "bad", indent = 0.6, justify = true } = {}) {
  ensureInk();
  const text = el.dataset.plain || el.textContent.trim();
  el.dataset.plain = text;
  const rnd = seeded("frame" + (seed ?? text));
  const L = lines || text.split(/\s+/);
  el.classList.add("framed");
  el.setAttribute("aria-label", text);
  el.innerHTML = "";
  let last = -1;
  L.forEach((line, i) => {
    let k; do k = Math.floor(rnd() * FRAMES.length); while (k === last); last = k;
    const [bg, fg] = FRAMES[k];
    const s = document.createElement("span");
    s.className = "frame"; s.setAttribute("aria-hidden", "true");
    s.style.cssText = `--fbg:${bg};--ffg:${fg};--find:${(i && rnd() < indent ? rnd() * 0.9 : 0).toFixed(2)}em;` +
      `--frot:${((rnd() - 0.5) * 1.4).toFixed(2)}deg;--fw:${rnd() < 0.3 ? 500 : 300}`;
    const ink = document.createElement("span"); ink.className = "frame__ink";
    const word = caps === "bad" ? line.split(" ").map((w) => badCase(w, rnd)).join(" ") : line;
    for (const c of word) {
      const g = document.createElement("span"); g.className = "fl"; g.textContent = c === " " ? " " : c;
      // this letter's own width / height / how hard it crashes into the next one
      const r = rnd();
      g._sx = WIDE.has(c) && r < 0.5 ? 1.12 + rnd() * 0.25 : 0.74 + rnd() * 0.26;
      g._sy = TALL.has(c) && rnd() < 0.25 ? 1.07 + rnd() * 0.12 : 1;
      g._kern = c === " " ? -0.12 : 0.012 + rnd() * 0.04;
      ink.append(g);
    }
    s.append(ink); el.append(s);
  });
  el._justify = justify && L.length > 1;
  all.add(el);
  layout(el);
  return el;
}

// measure the letters, then squeeze/stretch them and overlap them; stretch lines to one width
function layout(el) {
  const fs = parseFloat(getComputedStyle(el).fontSize) || 60;
  el.classList.remove("gooL", "gooM", "gooS");
  el.classList.add(fs > 130 ? "gooL" : fs > 70 ? "gooM" : "gooS");
  const rows = [...el.querySelectorAll(".frame")].map((f) => {
    const gs = [...f.querySelectorAll(".fl")];
    gs.forEach((g) => { g.style.transform = ""; g.style.marginRight = ""; });
    return { f, gs, ws: gs.map((g) => g.getBoundingClientRect().width) };
  });
  const natural = rows.map((r) => r.gs.reduce((a, g, i) => a + r.ws[i] * g._sx - g._kern * fs, 0));
  const target = Math.max(...natural);
  rows.forEach((r, i) => {
    const fit = el._justify ? Math.min(1.35, target / natural[i]) : 1;
    let tall = 1;
    r.gs.forEach((g, j) => {
      const sx = g._sx * fit, w = r.ws[j];
      g.style.transform = `scale(${sx.toFixed(3)}, ${g._sy.toFixed(3)})`;
      g.style.marginRight = `${(w * sx - w - g._kern * fs * (j === r.gs.length - 1 ? 0 : 1)).toFixed(1)}px`;
      tall = Math.max(tall, g._sy);
    });
    r.f.style.paddingTop = `${((tall - 1) * 0.72).toFixed(3)}em`;
  });
}
let rt = 0;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => all.forEach(layout), 150); });
// letters are measured, so re-measure once the title font has really arrived
const relayout = () => all.forEach(layout);
if (document.fonts) {
  Promise.all([document.fonts.load('300 64px "FrameSans"'), document.fonts.load('500 64px "FrameSans"')]).then(relayout, relayout);
  document.fonts.addEventListener?.("loadingdone", relayout);
}
addEventListener("load", () => setTimeout(relayout, 60));

// jelly wobble: briefly swap in the animated goo on hover, and once when a title first shows
export function jelly(el, ms = 1600) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.add("jelly-live"); clearTimeout(el._jt);
  el._jt = setTimeout(() => el.classList.remove("jelly-live"), ms);
}
export function jellyOnView(els) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); setTimeout(() => jelly(e.target), 250); } }), { threshold: 0.6 });
  els.forEach((el) => { io.observe(el); el.addEventListener("pointerenter", () => jelly(el, 1200)); });
}
