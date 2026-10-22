// Cover Flow carousel. One instance per Work section.
//   makeFlow(root, items, { onOpen(i), tint(i) })
//   items: [{ image, title, meta }]
import { el, clamp, smartImg } from "./util.js";
import { flowTick } from "./sound.js";

export function makeFlow(root, items, { onOpen, tint = () => "#0d0d0d", seed = "flow" } = {}) {
  root.innerHTML = `
    <div class="coverflow" tabindex="0"><div class="coverflow__stage"></div></div>
    <div class="cf-caption">
      <button class="cf-arrow" data-dir="-1" aria-label="Previous">◀◀</button>
      <div class="cf-caption__text"><strong></strong><span></span></div>
      <button class="cf-arrow" data-dir="1" aria-label="Next">▶▶</button>
    </div>`;
  const cf = root.querySelector(".coverflow"), stage = root.querySelector(".coverflow__stage");
  const capT = root.querySelector(".cf-caption__text strong"), capS = root.querySelector(".cf-caption__text span");
  let active = 0, dragged = false;
  const cards = items.map((it, i) => {
    const card = el("button", "cf-item");
    card.setAttribute("aria-label", it.title || "Untitled");
    card.append(smartImg(it.image, { label: it.title, color: tint(i), seed: seed + i }));
    card.addEventListener("click", () => { if (dragged) return; if (i === active) onOpen?.(i); else set(i); });
    stage.append(card);
    return card;
  });
  const W = () => cards[0]?.offsetWidth || 260;
  function layout(pos) {
    const w = W();
    cards.forEach((card, i) => {
      const d = i - pos, a = Math.abs(d), sg = Math.sign(d);
      if (a > 7) { card.style.visibility = "hidden"; return; }       // far cards: skip the work
      card.style.visibility = "";
      const x = a < 1 ? d * w * 0.75 : sg * (w * 0.75 + (a - 1) * w * 0.3);
      const ry = -sg * Math.min(a, 1) * 62, z = -Math.min(a, 1) * w * 0.55 + (a < 1 ? (1 - a) * 60 : 0);
      card.style.transform = `translate(-50%,-50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg)`;
      card.style.zIndex = 100 - Math.round(a * 10);
      card.style.opacity = a > 5.5 ? 0 : 1;
      card.classList.toggle("is-active", Math.round(pos) === i);
    });
  }
  function caption() {
    const it = items[active]; if (!it) return;
    capT.textContent = it.title || "Untitled";
    capS.textContent = `${it.meta || ""}${it.meta ? " · " : ""}${active + 1} / ${items.length}`;
  }
  function set(i) {
    const n = clamp(i, 0, cards.length - 1);
    if (n !== active) flowTick(n);
    active = n; layout(active); caption();
  }
  let x0 = 0, start = 0, down = false, dragIdx = 0;
  cf.addEventListener("pointerdown", (e) => { down = true; dragged = false; x0 = e.clientX; start = active; dragIdx = active; });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 6 && !dragged) { dragged = true; stage.classList.add("dragging"); }
    if (dragged) {
      const pos = clamp(start - dx / (W() * 0.45), -0.4, cards.length - 0.6), idx = Math.round(pos);
      if (idx !== dragIdx) { dragIdx = idx; flowTick(idx); }
      layout(pos);
    }
  });
  addEventListener("pointerup", (e) => {
    if (!down) return; down = false; stage.classList.remove("dragging");
    if (dragged) {
      const land = clamp(Math.round(start - (e.clientX - x0) / (W() * 0.45)), 0, cards.length - 1);
      if (land === dragIdx) { active = land; layout(active); caption(); } else set(land);
      setTimeout(() => (dragged = false), 0);
    }
  });
  let acc = 0;
  cf.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault(); acc += e.deltaX;
    if (Math.abs(acc) > 60) { set(active + Math.sign(acc)); acc = 0; }
  }, { passive: false });
  cf.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") set(active - 1);
    if (e.key === "ArrowRight") set(active + 1);
    if (e.key === "Enter") onOpen?.(active);
  });
  root.querySelectorAll(".cf-arrow").forEach((b) => (b.onclick = () => set(active + +b.dataset.dir)));
  addEventListener("resize", () => layout(active));
  layout(0); caption();
  return { set, get active() { return active; } };
}
