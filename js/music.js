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

// The <audio> element is created right away (not after a network check) so it
// is ready to start inside the visitor's very first tap.
function fileBackend(cfg, ui, onFail) {
  const a = new Audio();
  a.loop = true; a.preload = "auto"; a.volume = Math.min(1, (cfg.volume ?? 35) / 100);
  a.addEventListener("error", onFail, { once: true });   // missing file → fall back to YouTube
  a.src = cfg.file;
  attachMedia(a);                                   // lets the signal bars read the real levels
  a.addEventListener("play", () => ui.state(true));
  a.addEventListener("pause", () => ui.state(false));
  return {
    play: () => { resumeAudio(); return a.play(); }, pause: () => a.pause(),
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
  // a pause only lasts for this visit — every new visit starts with music
  const sess = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
  let wantOn = sess.get("music") !== "off";
  const ui = { state(on) { playing = on; box.classList.toggle("is-playing", on); btn.textContent = on ? "❚❚" : "▶"; if (on) started = true; } };
  const play = () => { if (!backend || held) return; try { const r = backend.play(); r?.catch?.(() => {}); } catch {} };
  const pause = () => backend?.pause();
  const setTitle = () => { if (backend?.title) titleEl.textContent = backend.title; };

  const useYouTube = async () => {
    if (!id) { box.remove(); return; }
    try { backend = await youtubeBackend(cfg, id, ui); setTitle(); if (wantOn && started) play(); }
    catch { box.remove(); }
  };
  if (cfg.file) { backend = fileBackend(cfg, ui, () => { backend = null; useYouTube(); }); setTitle(); }
  else useYouTube();

  // Start on the first real interaction anywhere: a tap, click, opening the
  // iPod menu, a key. Browsers only allow sound on the *end* of a tap
  // (touchend / pointerup / click), so we listen for those and keep trying
  // on each interaction until playback has actually begun.
  const kick = (e) => {
    if (playing || !wantOn || held) return;
    if (e && pill.contains(e.target)) return;   // the pill's own click handles it
    started = true;
    play();
  };
  for (const ev of ["pointerup", "touchend", "click", "keydown"]) addEventListener(ev, kick, { passive: true, capture: true });

  pill.addEventListener("click", () => {
    started = true;
    if (playing) { wantOn = false; pause(); } else { wantOn = true; play(); }
    sess.set("music", wantOn ? "on" : "off");
  });

  return {
    isPlaying: () => playing,
    hold(on) {
      if (on) { held = true; if (playing) pause(); }
      else { held = false; if (wantOn && started) play(); }
    },
  };
}
