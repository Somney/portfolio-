// Background music from a YouTube video (set in content.js → music).
// Browsers block sound until the visitor interacts, so it starts on the
// first tap/click/key anywhere. The pill bottom-right plays/pauses; the
// choice is remembered. Music pauses while a video is open in the pop-up.
import { el, esc } from "./util.js";

const ytId = (s = "") => (s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(s) ? s : null);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export function initMusic(cfg) {
  const id = ytId(cfg?.youtube);
  if (!id) return null;

  const box = el("div", "np");
  box.innerHTML = `
    <div class="np__player"><div id="np-yt"></div></div>
    <button class="np__pill" aria-label="Play or pause music">
      <img class="np__art" src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" />
      <span class="np__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="np__txt"><b>Now playing</b><span class="np__title">${esc(cfg.title || "tap to play")}</span></span>
      <span class="np__btn" aria-hidden="true">▶</span>
    </button>`;
  document.body.append(box);
  const pill = box.querySelector(".np__pill"), titleEl = box.querySelector(".np__title"), btn = box.querySelector(".np__btn");

  let player = null, ready = false, playing = false, held = false;
  let wantOn = store.get("music") !== "off";        // visitor's last choice
  const setUI = () => { box.classList.toggle("is-playing", playing); btn.textContent = playing ? "❚❚" : "▶"; };

  const play = () => { if (ready && !held) player.playVideo(); };
  const pause = () => { if (ready) player.pauseVideo(); };

  // load YouTube's player script
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    player = new YT.Player("np-yt", {
      videoId: id, width: 200, height: 200,
      playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: id, playsinline: 1, rel: 0, start: cfg.start || 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ready = true;
          player.setVolume(cfg.volume ?? 35);
          const t = cfg.title || player.getVideoData?.().title;
          if (t) titleEl.textContent = t;
          if (startedByGesture && wantOn) play();
        },
        onStateChange: (e) => { playing = e.data === 1; setUI(); },
      },
    });
  };
  const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
  s.onerror = () => box.remove();           // blocked → no widget
  document.head.append(s);

  // first interaction anywhere starts the music
  let startedByGesture = false;
  const kick = (e) => {
    if (startedByGesture) return;
    startedByGesture = true;
    if (e && pill.contains(e.target)) return;  // the pill's own click handles it
    if (wantOn) play();
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, kick, { once: true, passive: true, capture: true });

  pill.addEventListener("click", () => {
    startedByGesture = true;
    if (playing) { wantOn = false; pause(); } else { wantOn = true; play(); }
    store.set("music", wantOn ? "on" : "off");
  });

  return {
    // pause under another video, resume after (only if it was on)
    hold(on) {
      if (on) { held = true; if (playing) pause(); }
      else { held = false; if (wantOn && startedByGesture) play(); }
    },
  };
}
