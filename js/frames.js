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
  // inkText: slow liquid warp, then a soft blur pulled back to a hard edge — strokes
  //          swell and taper and corners melt together, but the outline stays crisp
  // inkBlock: the colour block gets just the warp, so its edges wobble like a hand-pulled print
  svg.innerHTML = `
    <filter id="inkText" x="-6%" y="-10%" width="112%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="1" seed="11" result="flow"/>
      <feDisplacementMap in="SourceGraphic" in2="flow" scale="3" xChannelSelector="R" yChannelSelector="G" result="warped"/>
      <feGaussianBlur in="warped" stdDeviation="1.4" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9.6"/>
    </filter>
    <filter id="inkBlock" x="-3%" y="-6%" width="106%" height="112%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="flow"/>
      <feDisplacementMap in="SourceGraphic" in2="flow" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
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
  return el;
}
