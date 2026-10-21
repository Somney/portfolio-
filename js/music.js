// Background music (content.js → music).
//   file:    an audio file in the repo, e.g. "assets/music/song.mp3".
//            Plays instantly, no ads. Used first when it exists.
//   youtube: a YouTube link — fallback. YouTube may play an ad first;
//            a website can't turn those off.
// Browsers block sound until the visitor interacts, so music starts on
// the first tap/click/key anywhere. The pill bottom-right plays/pauses
// (remembered), and music pauses while a video is open in the pop-up.
import { el, esc } from "./util.js";
import { attachMedia, resumeAudio } from "./sound.js";

const ytId = (s = "") => (s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(s) ? s : null);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

async function fileBackend(cfg, ui) {
  // iPhones don't preload audio before a tap, so just confirm the file exists
  const r = await fetch(cfg.file, { method: "HEAD" });
  if (!r.ok) throw new Error("file missing");
  const a = new Audio(cfg.file);
  a.loop = true; a.preload = "auto"; a.volume = Math.min(1, (cfg.volume ?? 35) / 100);
  attachMedia(a);                                   // lets the signal bars read the real levels
  a.addEventListener("play", () => ui.state(true));
  a.addEventListener("pause", () => ui.state(false));
  return {
    play: () => { resumeAudio(); a.play().catch(() => {}); }, pause: () => a.pause(),
    title: cfg.title || decodeURIComponent(cfg.file.split("/").pop().replace(/\.\w+$/, "").replace(/[-_]+/g, " ")),
  };
}

function youtubeBackend(cfg, id, ui) {
  return new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      const player = new YT.Player("np-yt", {
        videoId: id, width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: id, playsinline: 1, rel: 0, start: cfg.start || 0 },
        events: {
          onReady: () => {
            player.setVolume(cfg.volume ?? 35);
            resolve({ play: () => player.playVideo(), pause: () => player.pauseVideo(), title: cfg.title || player.getVideoData?.().title });
          },
          onStateChange: (e) => ui.state(e.data === 1),
        },
      });
    };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => reject(new Error("YouTube blocked"));
    document.head.append(s);
  });
}

export function initMusic(cfg) {
  const id = ytId(cfg?.youtube);
  if (!cfg?.file && !id) return null;

  const box = el("div", "np");
  const art = cfg.cover || (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : "");
  box.innerHTML = `
    <div class="np__player"><div id="np-yt"></div></div>
    <button class="np__pill" aria-label="Play or pause music">
      ${art ? `<img class="np__art" src="${esc(art)}" alt="" />` : `<span class="np__art np__art--disc"></span>`}
      <span class="np__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="np__txt"><b>Now playing</b><span class="np__title">${esc(cfg.title || "tap to play")}</span></span>
      <span class="np__btn" aria-hidden="true">▶</span>
    </button>`;
  document.body.append(box);
  const pill = box.querySelector(".np__pill"), titleEl = box.querySelector(".np__title"), btn = box.querySelector(".np__btn");

  let backend = null, playing = false, held = false, started = false;
  let wantOn = store.get("music") !== "off";
  const ui = { state(on) { playing = on; box.classList.toggle("is-playing", on); btn.textContent = on ? "❚❚" : "▶"; } };
  const play = () => { if (backend && !held) backend.play(); };
  const pause = () => backend?.pause();

  (async () => {
    if (cfg.file) { try { backend = await fileBackend(cfg, ui); } catch { backend = null; } }
    if (!backend && id) { try { backend = await youtubeBackend(cfg, id, ui); } catch { backend = null; } }
    if (!backend) { box.remove(); return; }
    if (backend.title) titleEl.textContent = backend.title;
    if (started && wantOn) play();
  })();

  // first interaction anywhere starts the music
  const kick = (e) => {
    if (started) return;
    started = true;
    if (e && pill.contains(e.target)) return;   // the pill's own click handles it
    if (wantOn) play();
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, kick, { once: true, passive: true, capture: true });

  pill.addEventListener("click", () => {
    started = true;
    if (playing) { wantOn = false; pause(); } else { wantOn = true; play(); }
    store.set("music", wantOn ? "on" : "off");
  });

  return {
    isPlaying: () => playing,
    hold(on) {
      if (on) { held = true; if (playing) pause(); }
      else { held = false; if (wantOn && started) play(); }
    },
  };
}
