// Sorts posts into sections by hashtag / caption keywords.
// Shared by the website and scripts/sync-social.mjs so both agree.
//
// rules: content.js → social.sort, e.g.
//   { id: "timelapse", title: "Timelapses", match: ["timelapse", "speedpaint"] }
// A post goes into the FIRST section whose keywords it matches
// (as a #hashtag, or as a word in the caption). A rule with
// match: "*" collects everything left over.

const norm = (s) => String(s).toLowerCase().replace(/^#/, "").trim();

export function matches(post, words) {
  const tags = new Set((post.tags || []).map(norm));
  const caption = ` ${String(post.caption || "").toLowerCase().replace(/[^\p{L}\p{N}#]+/gu, " ")} `;
  return words.some((w) => {
    const k = norm(w);
    if (!k) return false;
    if (tags.has(k)) return true;
    // "speed paint" in a caption matches the keyword "speedpaint" too
    return caption.includes(` ${k} `) || caption.includes(` #${k} `) || (k.length > 5 && caption.replace(/ /g, "").includes(k));
  });
}

export function sortPosts(posts, rules = [], { hide = [] } = {}) {
  const visible = posts.filter((p) => !p.hidden && !(hide.length && matches({ ...p, caption: "" }, hide)));
  const buckets = rules.map((r) => ({ ...r, posts: [] }));
  const rest = buckets.find((b) => b.match === "*");
  for (const p of visible) {
    const b = buckets.find((b) => Array.isArray(b.match) && matches(p, b.match)) || rest;
    if (b) b.posts.push(p);
  }
  return buckets;
}
