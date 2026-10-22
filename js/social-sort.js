// Sorts posts into sections by hashtag (and optionally caption phrases).
// Shared by the website and scripts/sync-social.mjs so both agree.
//
// rules: content.js → social.sort, e.g.
//   { id: "timelapse", title: "Timelapses", match: ["timelapse"], phrases: ["drawing stream"] }
// A post goes into the FIRST section with a matching #hashtag in `match`,
// or (if given) a caption containing one of the `phrases`.
// A rule with match: "*" collects everything left over; add platform: "instagram"
// to a rule to only use it for posts from that platform.

const norm = (s) => String(s).toLowerCase().replace(/^#/, "").trim();
const flat = (s) => ` ${String(s || "").toLowerCase().replace(/#[\p{L}\p{N}_]+/gu, " ").replace(/[^\p{L}\p{N}]+/gu, " ")} `;

export function matches(post, rule) {
  if (rule.platform && post.platform !== rule.platform) return false;
  const tags = new Set((post.tags || []).map(norm));
  if ((rule.match || []).some((w) => tags.has(norm(w)))) return true;
  if (rule.phrases?.length) {
    const cap = flat(post.caption);
    return rule.phrases.some((p) => cap.includes(flat(p)));
  }
  return false;
}

export function sortPosts(posts, rules = [], { hide = [] } = {}) {
  const visible = posts.filter((p) => !p.hidden && !(hide.length && matches(p, { match: hide })));
  const buckets = rules.map((r) => ({ ...r, posts: [] }));
  const rests = buckets.filter((b) => b.match === "*");   // catch-alls (optionally per platform)
  for (const p of visible) {
    const b = buckets.find((b) => Array.isArray(b.match) && matches(p, b)) || rests.find((r) => !r.platform || r.platform === p.platform);
    if (b) b.posts.push(p);
  }
  return buckets;
}
