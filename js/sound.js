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

// Soft click-wheel tick: a tiny filtered noise "tk" plus a quick muted
// sine — clicky like an iPod wheel, nowhere near a beep.
export function blip(freq = 1800) {
  const a = ac(); if (!a) return;
  const t = a.currentTime;
  const n = Math.floor(a.sampleRate * 0.01);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const src = a.createBufferSource(); src.buffer = buf;
  const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2200;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
  const ng = a.createGain(); ng.gain.value = 0.06;
  src.connect(hp).connect(lp).connect(ng).connect(a.destination); src.start(t);
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine"; o.frequency.value = Math.min(2600, Math.max(1400, freq));
  g.gain.setValueAtTime(0.012, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.03);
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

// Cover Flow tick: a soft, rounded click sent through a gentle echo
// (short delay with filtered feedback) — like flicking through covers on
// an iPod in a quiet room. Rate-limited so fast drags stay smooth.
let echo = null, lastFlow = 0;
function echoBus(a) {
  if (echo) return echo;
  const input = a.createGain(), wet = a.createGain(), d = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter();
  d.delayTime.value = 0.105; fb.gain.value = 0.34; lp.type = "lowpass"; lp.frequency.value = 2200; wet.gain.value = 0.45;
  input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(a.destination);
  input.connect(a.destination);                      // dry signal
  return (echo = input);
}
export function flowTick(i = 0) {
  const a = ac(); if (!a) return;
  const now = performance.now(); if (now - lastFlow < 38) return; lastFlow = now;
  const t = a.currentTime, bus = echoBus(a);
  // soft "tk": short noise burst through a bandpass
  const n = Math.floor(a.sampleRate * 0.014), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 1.1;
  const ng = a.createGain(); ng.gain.value = 0.09;
  src.connect(bp).connect(ng).connect(bus); src.start(t);
  // warm body under it, pitch drifts slightly per cover
  const o = a.createOscillator(), g = a.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(1050 + (i % 7) * 35, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(bus); o.start(t); o.stop(t + 0.08);
}
