// "Text frame" titling, after notyourtype's commonSans Condensed badKern posts:
// squeezed letters that bump into each other, every line on its own flat colour
// block, blocks nudged left/right, a few letters flipped to the wrong case.
// frame(el, { lines, seed, caps })  — lines: array of strings (default: the words)
import { seeded } from "./util.js";

// block colour + letter colour pairs, taken from the reference posts
export const FRAMES = [
  ["#0a8cff", "#0d0d0d"], ["#ff8cff", "#0d0d0d"], ["#58c95a", "#0d0d0d"], ["#6e5a12", "#0d0d0d"],
  ["#fff27a", "#0d0d0d"], ["#5b4513", "#ff1a1a"], ["#18ff20", "#ff1a1a"], ["#49a8ff", "#6e5a12"],
  ["#ffe600", "#0d2a24"], ["#2a1a1e", "#ff8cff"], ["#0aa0e0", "#0d0d0d"], ["#6e5a12", "#1f2bff"],
];

// mixed case like "SociaLLY AwkWard": mostly as written, a few letters flipped
function badCase(word, rnd) {
  return [...word].map((c, i) => {
    if (!/[a-z]/i.test(c)) return c;
    const flip = i > 0 && rnd() < 0.28;
    const base = i === 0 ? c.toUpperCase() : c.toLowerCase();
    return flip ? (base === base.toUpperCase() ? base.toLowerCase() : base.toUpperCase()) : base;
  }).join("");
}

// printed-ink look: rough, slightly bled edges + specks where the ink didn't take,
// as one SVG filter shared by every frame (built once, static, so it stays cheap)
let inkReady = false;
export function ensureInk() {
  if (inkReady) return; inkReady = true;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  // jellyL/M/S: no noise, no warp — the strokes stay clean and digital. A soft blur pulled
  //   back to a hard edge only changes the shape where strokes meet or crowd each other:
  //   those inner corners fill in smoothly, like ink pooling where a press squeezes it.
  //   Straight runs and outer curves keep their exact width (threshold at half alpha).
  svg.innerHTML = `
    <filter id="jellyL" x="-6%" y="-10%" width="112%" height="120%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.1" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -5.6"/>
    </filter>
    <filter id="jellyM" x="-6%" y="-10%" width="112%" height="120%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.0" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 11 -5.1"/>
    </filter>
    <filter id="jellyS" x="-6%" y="-10%" width="112%" height="120%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 10 -4.6"/>
    </filter>`;
  document.body.prepend(svg);
}

export function frame(el, { lines, seed, caps = "bad", indent = 0.6 } = {}) {
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
    s.className = "frame";
    s.setAttribute("aria-hidden", "true");
    s.textContent = caps === "bad" ? line.split(" ").map((w) => badCase(w, rnd)).join(" ") : line;
    s.style.cssText = `--fbg:${bg};--ffg:${fg};--find:${(i && rnd() < indent ? rnd() * 0.9 : 0).toFixed(2)}em;` +
      `--frot:${((rnd() - 0.5) * 1.6).toFixed(2)}deg;--fmx:${((rnd() - 0.5) * 0.05).toFixed(3)}em;--fmy:${((rnd() - 0.5) * 0.04).toFixed(3)}em`;
    const ink = document.createElement("span"); ink.className = "frame__ink"; ink.textContent = s.textContent;
    s.textContent = ""; s.append(ink);
    el.append(s);
  });
  sizeJelly(el);
  return el;
}

// the jelly (how far joins melt) is in pixels, so pick the strength from the title's size
const framedEls = new Set();
function sizeJelly(el) {
  framedEls.add(el);
  const fs = parseFloat(getComputedStyle(el).fontSize) || 80;
  el.dataset.jelly = fs >= 150 ? "L" : fs >= 90 ? "M" : "S";
}
let jt = 0;
addEventListener("resize", () => { clearTimeout(jt); jt = setTimeout(() => framedEls.forEach(sizeJelly), 200); });
