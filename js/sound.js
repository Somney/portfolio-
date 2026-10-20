// Tiny synthesized sounds (no audio files): click-wheel ticks + paper flips.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem("muted") === "1"; } catch {}

function ac() {
  if (muted) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { localStorage.setItem("muted", v ? "1" : "0"); } catch {} }

export function blip(freq = 1200, dur = 0.02) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "square"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.03, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}

// Filtered noise swoosh that sounds like a page turning.
export function pageFlip(strength = 1) {
  const a = ac(); if (!a) return;
  const dur = 0.32, n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.6)), 2) * (1 - t) * (0.6 + 0.4 * Math.random());
  }
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800 + Math.random() * 1200; f.Q.value = 0.6;
  const g = a.createGain(); g.gain.value = 0.25 * strength;
  src.connect(f).connect(g).connect(a.destination); src.start();
}
