#!/usr/bin/env node
/* ==========================================================================
   sync-social.mjs — pulls your TikTok (and optionally Instagram) posts,
   keeps each caption + hashtags, saves cover images into the repo, and
   writes social/feed.json. The website sorts those posts into sections
   by hashtag (rules live in content.js → social.sort).

   Runs automatically every day via .github/workflows/site.yml.
   Run it yourself:   node scripts/sync-social.mjs
     needs: Node 18+, and `pip install yt-dlp` for TikTok discovery
   Extra links:       social/links.txt  (one post URL per line, optional
                      "#tags" after it) — for posts the auto-discovery
                      misses, or Instagram posts without a token.
   Instagram:         set env INSTAGRAM_TOKEN (see README) to auto-pull.
   Test offline:      node scripts/sync-social.mjs --fixture scripts/fixture.json
   ========================================================================== */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEED = path.join(ROOT, "social/feed.json");
const LINKS = path.join(ROOT, "social/links.txt");
const MEDIA = "assets/social";
const args = process.argv.slice(2);
const fixture = args.includes("--fixture") ? args[args.indexOf("--fixture") + 1] : null;

const { default: content } = await import(path.join(ROOT, "content.js"));
const cfg = content.social || {};
const LIMIT = cfg.limit || 80;
const log = (...a) => console.log("•", ...a);
const warn = (...a) => console.warn("⚠", ...a);

/* ---------- helpers ---------- */
export const hashtags = (text = "") => [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()))];
const cleanTitle = (text = "") => {
  const t = text.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/@[\w.]+/g, "").replace(/\s+/g, " ").trim();
  return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, "") + "…" : t;
};
// TikTok ids encode the upload time in their top 32 bits.
const tiktokDate = (id) => { try { return new Date(Number(BigInt(id) >> 32n) * 1000).toISOString(); } catch { return null; } };
const exists = (p) => fs.access(p).then(() => true, () => false);

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (portfolio-sync)" } });
      if (r.ok) return await r.json();
      if (r.status < 500 && r.status !== 429) throw new Error(`HTTP ${r.status}`);
    } catch (e) { if (i === tries - 1) throw e; }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
}
async function download(url, rel) {
  const abs = path.join(ROOT, rel);
  if (await exists(abs)) return rel;
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (portfolio-sync)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await r.arrayBuffer()));
  return rel;
}

/* ---------- load what we already have ---------- */
let old = { posts: [] };
try { old = JSON.parse(await fs.readFile(FEED, "utf8")); } catch {}
const posts = new Map(old.posts.map((p) => [`${p.platform}:${p.id}`, p]));
const report = { discovered: 0, added: 0, updated: 0, errors: [] };

function upsert(p) {
  const key = `${p.platform}:${p.id}`;
  const prev = posts.get(key);
  // keep fields you edited by hand (title, hidden, extraTags) across syncs
  const merged = { ...prev, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== "")) };
  if (prev?.title && prev.titleLocked) merged.title = prev.title;
  merged.tags = [...new Set([...(hashtags(merged.caption)), ...(p.tags || []), ...(prev?.extraTags || [])])];
  posts.set(key, merged);
  prev ? report.updated++ : report.added++;
  return merged;
}

/* ---------- TikTok ---------- */
async function discoverTikTok(user) {
  if (fixture) return JSON.parse(await fs.readFile(path.resolve(fixture), "utf8")).tiktok || [];
  try {
    const { stdout } = await run("yt-dlp", [
      "--flat-playlist", "--dump-single-json", "--no-warnings", "--ignore-errors",
      "--playlist-end", String(LIMIT), `https://www.tiktok.com/@${user}`,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
    const data = JSON.parse(stdout);
    return (data.entries || []).filter(Boolean).map((e) => ({
      id: String(e.id), caption: e.description || e.title || "", timestamp: e.timestamp,
      thumb: e.thumbnail || e.thumbnails?.at(-1)?.url, duration: e.duration, views: e.view_count,
    }));
  } catch (e) {
    warn(`TikTok auto-discovery failed (${String(e.stderr || e.message).split("\n").filter(Boolean).at(-1)}).`,
      "Posts already saved are kept; add missing ones to social/links.txt.");
    report.errors.push("tiktok-discovery");
    return [];
  }
}

async function enrichTikTok(user, v) {
  const url = `https://www.tiktok.com/@${user}/video/${v.id}`;
  // oEmbed: TikTok's official public lookup — gives caption + a cover image
  if (!fixture && (!v.caption || !v.thumb)) {
    try {
      const o = await getJSON(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      v.caption ||= o.title; v.thumb ||= o.thumbnail_url;
    } catch (e) { warn(`oEmbed failed for ${v.id}: ${e.message}`); }
  }
  let image = null;
  if (v.thumb && !fixture) {
    try { image = await download(v.thumb, `${MEDIA}/tiktok/${v.id}.jpg`); }
    catch (e) { warn(`cover download failed for ${v.id}: ${e.message}`); }
  } else if (await exists(path.join(ROOT, `${MEDIA}/tiktok/${v.id}.jpg`))) image = `${MEDIA}/tiktok/${v.id}.jpg`;
  return upsert({
    platform: "tiktok", id: v.id, url, caption: v.caption || "", title: cleanTitle(v.caption || ""),
    date: v.timestamp ? new Date(v.timestamp * 1000).toISOString() : tiktokDate(v.id),
    image, duration: v.duration, views: v.views, tags: v.tags,
  });
}

/* ---------- Finished-artwork images ----------
   A TikTok cover is often a title card or the blank first frame of a
   timelapse. For posts that feed the Paintings section we look for a
   better picture of the finished piece:
     videos     → a frame from the very end (where the piece is done)
     slideshows → the photo slides themselves (slide 2 is usually the art)
   Result: post.art (+ post.slides). Set "artLocked": true on a post in
   social/feed.json and put your own path in "art" to override.          */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TMP = path.join(ROOT, ".sync-tmp");

// TikTok's post page carries the post data (slides, video address) as JSON.
async function pageItem(p) {
  const r = await fetch(p.url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  const cookies = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const html = await r.text();
  const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no page data (HTTP ${r.status})`);
  const item = JSON.parse(m[1]).__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!item) throw new Error("post data missing from page");
  return { item, cookies };
}

async function frameFromFile(p, file) {
  const rel = `${MEDIA}/tiktok/${p.id}-final.jpg`;
  await fs.mkdir(path.join(ROOT, path.dirname(rel)), { recursive: true });
  // 0.4s before the end: past the drawing, before any end-card fade
  await run("ffmpeg", ["-y", "-loglevel", "error", "-sseof", "-0.4", "-i", file, "-frames:v", "1", "-q:v", "3", path.join(ROOT, rel)], { timeout: 60_000 });
  return rel;
}

async function videoFromPage(p, item, cookies) {
  const v = item.video || {};
  const src = v.playAddr || v.downloadAddr || v.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];
  if (!src) throw new Error("no video address on page");
  const r = await fetch(src, { headers: { "user-agent": UA, referer: "https://www.tiktok.com/", cookie: cookies, range: "bytes=0-" } });
  if (!r.ok) throw new Error(`video HTTP ${r.status}`);
  await fs.mkdir(TMP, { recursive: true });
  const file = path.join(TMP, `${p.id}.mp4`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
  try { return await frameFromFile(p, file); } finally { await fs.rm(file, { force: true }); }
}

async function videoFromYtdlp(p) {
  await fs.mkdir(TMP, { recursive: true });
  const file = path.join(TMP, `${p.id}.mp4`);
  await run("yt-dlp", ["-q", "--no-warnings", "-f", "b[height<=1080][ext=mp4]/b[ext=mp4]/b", "-o", file, p.url], { timeout: 180_000 });
  try { return await frameFromFile(p, file); } finally { await fs.rm(file, { force: true }); }
}

async function findArt(p) {
  if (p.platform !== "tiktok" || p.artLocked || p.art) return;
  const errors = [];
  let page = null;
  try { page = await pageItem(p); } catch (e) { errors.push(`page: ${e.message}`); }
  const slides = (page?.item?.imagePost?.images || []).map((i) => {
    const list = i.imageURL?.urlList || [];
    return list.find((u) => /jpe?g/i.test(u)) || list[0];
  }).filter(Boolean).slice(0, 12);
  if (slides.length) {
    p.slides = [];
    for (const [i, u] of slides.entries()) {
      try { p.slides.push(await download(u, `${MEDIA}/tiktok/${p.id}-${i + 1}.jpg`)); } catch (e) { errors.push(`slide ${i + 1}: ${e.message}`); }
    }
    if (p.slides.length) { p.art = p.slides[p.slides.length > 1 ? 1 : 0]; log(`  slides ${p.id}: ${p.slides.length}`); }
  } else {
    if (page) { try { p.art = await videoFromPage(p, page.item, page.cookies); } catch (e) { errors.push(`video: ${e.message}`); } }
    if (!p.art) { try { p.art = await videoFromYtdlp(p); } catch (e) { errors.push(`yt-dlp: ${String(e.stderr || e.message).trim().split("\n").at(-1).slice(0, 120)}`); } }
    if (p.art) log(`  final frame ${p.id}`);
  }
  if (!p.art) { p.artFails = (p.artFails || 0) + 1; warn(`no artwork image for ${p.id} (try ${p.artFails}/3): ${errors.join(" | ")}`); }
  else delete p.artFails;
  delete p.artTried;
}

/* ---------- Instagram, no token: read the public profile ----------
   Uses the same public endpoint instagram.com's own web page uses. It
   returns the newest ~12 posts; older ones stay saved from earlier runs,
   so the collection grows day by day. Carousels → all slides, videos →
   a frame from the end (finished piece), photos → the photo itself.     */
const IG_APP = "936619743392459"; // instagram.com's public web app id
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IG_UA_APP = "Instagram 309.1.0.41.113 Android (31/12; 420dpi; 1080x2220; samsung; SM-G991B; o1s; exynos2100; en_US; 541635890)";

// Route 1: the JSON endpoint instagram.com's own page uses (fullest data).
async function igApi(user) {
  const tries = [
    ["https://www.instagram.com", UA, IG_APP],
    ["https://i.instagram.com", IG_UA_APP, "567067343352427"],
  ];
  const errs = [];
  for (const [host, ua, app] of tries) {
    const r = await fetch(`${host}/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`, {
      headers: { "user-agent": ua, "x-ig-app-id": app, accept: "*/*", "accept-language": "en-US,en;q=0.9", referer: `https://www.instagram.com/${user}/` },
    }).catch((e) => ({ ok: false, status: e.message }));
    if (!r.ok) { errs.push(`${host.slice(8)} ${r.status}`); continue; }
    const u = (await r.json().catch(() => null))?.data?.user;
    if (!u) { errs.push(`${host.slice(8)} no data`); continue; }
    if (u.is_private) throw new Error("account is private");
    return (u.edge_owner_to_timeline_media?.edges || []).map((e) => e.node);
  }
  throw new Error(errs.join(", "));
}

// Route 2: the public embed pages (what other websites load). Lists recent
// post codes from the profile embed, then reads each post's embed page.
async function igEmbedPost(code) {
  const r = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  const html = await r.text();
  const dec = (t) => t.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const capM = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/);
  let caption = capM ? dec(capM[1]).replace(/^\S+\s*/, "") : "";           // drop the leading username
  const img = (html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");
  const ts = (html.match(/"taken_at_timestamp":(\d+)/) || [])[1];
  return { shortcode: code, caption, display_url: img, taken_at_timestamp: ts ? +ts : null, is_video: /"is_video":true/.test(html) };
}
async function igEmbed(user) {
  const r = await fetch(`https://www.instagram.com/${encodeURIComponent(user)}/embed/`, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  if (!r.ok) throw new Error(`profile embed ${r.status}`);
  const html = (await r.text()).replace(/\\\//g, "/");
  const codes = [...new Set([...html.matchAll(/\/(?:p|reel)\/([\w-]{6,})/g)].map((m) => m[1]))].slice(0, 24);
  if (!codes.length) throw new Error("profile embed had no posts");
  const out = [];
  for (const c of codes) { try { out.push(await igEmbedPost(c)); } catch (e) { warn(`IG embed ${c}: ${e.message}`); } await sleep(800); }
  return out.map((n) => ({ ...n, edge_media_to_caption: { edges: [{ node: { text: n.caption } }] } }));
}

async function igProfile(user) {
  const errs = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await igApi(user); } catch (e) { errs.push(`api#${attempt}: ${e.message}`); if (/private/.test(e.message)) throw e; }
    try { return await igEmbed(user); } catch (e) { errs.push(`embed#${attempt}: ${e.message}`); }
    if (attempt < 3) await sleep(20_000 * attempt);
  }
  throw new Error(errs.join(" | "));
}

async function igFrame(id, videoUrl) {
  await fs.mkdir(TMP, { recursive: true });
  const file = path.join(TMP, `ig-${id}.mp4`);
  const r = await fetch(videoUrl, { headers: { "user-agent": UA, referer: "https://www.instagram.com/" } });
  if (!r.ok) throw new Error(`video HTTP ${r.status}`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
  const rel = `${MEDIA}/instagram/${id}-final.jpg`;
  await fs.mkdir(path.join(ROOT, path.dirname(rel)), { recursive: true });
  try { await run("ffmpeg", ["-y", "-loglevel", "error", "-sseof", "-0.4", "-i", file, "-frames:v", "1", "-q:v", "3", path.join(ROOT, rel)], { timeout: 60_000 }); }
  finally { await fs.rm(file, { force: true }); }
  return rel;
}

async function syncInstagramPublic(user) {
  let nodes;
  try { nodes = await igProfile(user); }
  catch (e) { warn(`Instagram @${user}: couldn't read the public profile (${e.message}). Saved posts are kept.`); report.errors.push("instagram"); return; }
  log(`Instagram @${user}: found ${nodes.length} post(s)`);
  for (const n of nodes) {
    report.discovered++;
    const code = n.shortcode, prev = posts.get(`instagram:${code}`);
    const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text || "";
    const p = { platform: "instagram", id: code, url: `https://www.instagram.com/p/${code}/`, caption, title: cleanTitle(caption),
      date: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null, video: !!n.is_video };
    try {
      if (!prev?.image) p.image = await download(n.display_url, `${MEDIA}/instagram/${code}.jpg`);
      const kids = n.edge_sidecar_to_children?.edges?.map((e) => e.node) || [];
      if (kids.length > 1 && !prev?.slides) {
        p.slides = [];
        for (const [i, k] of kids.entries()) if (!k.is_video) p.slides.push(await download(k.display_url, `${MEDIA}/instagram/${code}-${i + 1}.jpg`));
        p.art = p.slides[0];
      } else if (n.is_video && n.video_url && !prev?.art) {
        try { p.art = await igFrame(code, n.video_url); } catch (e) { warn(`IG end frame ${code}: ${e.message}`); }
      } else if (!n.is_video) p.art = prev?.art || p.image || prev?.image;
    } catch (e) { warn(`IG media ${code}: ${e.message}`); }
    upsert(p);
  }
}

/* ---------- Instagram (optional, needs a token) ---------- */
async function syncInstagram(token) {
  try {
    // keep the 60-day token alive
    await getJSON(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`, 1).catch(() => {});
    let url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50&access_token=${token}`;
    let n = 0;
    while (url && n < LIMIT) {
      const page = await getJSON(url);
      for (const m of page.data || []) {
        if (n++ >= LIMIT) break;
        report.discovered++;
        const src = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
        let image = null;
        if (src) { try { image = await download(src, `${MEDIA}/instagram/${m.id}.jpg`); } catch (e) { warn(`IG image ${m.id}: ${e.message}`); } }
        upsert({ platform: "instagram", id: m.id, url: m.permalink, caption: m.caption || "", title: cleanTitle(m.caption || ""),
          date: m.timestamp ? new Date(m.timestamp).toISOString() : null, image, video: m.media_type === "VIDEO" });
      }
      url = page.paging?.next;
    }
  } catch (e) { warn(`Instagram sync failed: ${e.message}`); report.errors.push("instagram"); }
}

/* ---------- social/links.txt (manual extras) ---------- */
async function manualLinks(user) {
  let text = "";
  try { text = await fs.readFile(LINKS, "utf8"); } catch { return; }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith(";")) continue;
    const [url, ...rest] = line.split(/\s+/);
    const tags = hashtags(rest.join(" "));
    const tt = url.match(/tiktok\.com\/@([\w.-]+)\/video\/(\d+)/);
    const ig = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
    if (tt) {
      report.discovered++;
      const known = posts.get(`tiktok:${tt[2]}`);
      await enrichTikTok(tt[1] || user, { id: tt[2], caption: known?.caption, thumb: null, tags });
    } else if (ig) {
      const id = ig[2];
      const prev = posts.get(`instagram:${id}`);
      upsert({ platform: "instagram", id, url: `https://www.instagram.com/${ig[1]}/${id}/`, caption: prev?.caption || rest.join(" "),
        title: prev?.title || cleanTitle(rest.join(" ")), date: prev?.date || new Date().toISOString(), tags, embedOnly: !prev?.image });
    } else warn(`links.txt: not a TikTok/Instagram post link → ${url}`);
  }
}

/* ---------- go ---------- */
const tt = (cfg.tiktok || "").replace(/^@/, "");
if (tt) {
  const found = await discoverTikTok(tt);
  report.discovered += found.length;
  log(`TikTok @${tt}: found ${found.length} video(s)`);
  for (const v of found) {
    const known = posts.get(`tiktok:${v.id}`);
    if (known?.image && known.caption && !v.caption) continue;
    await enrichTikTok(tt, v);
  }
}
if (process.env.INSTAGRAM_TOKEN) await syncInstagram(process.env.INSTAGRAM_TOKEN);
else if (cfg.instagram && !fixture) await syncInstagramPublic(cfg.instagram.replace(/^@/, ""));
await manualLinks(tt);

const { sortPosts } = await import("../js/social-sort.js");
if (!fixture && !args.includes("--no-art")) {
  const forPaintings = sortPosts([...posts.values()], cfg.sort || [], { hide: cfg.hide || [] })
    .filter((b) => b.inPaintings).flatMap((b) => b.posts);
  const todo = forPaintings.filter((p) => !p.art && !p.artLocked && (p.artFails || 0) < 3);
  if (todo.length) log(`Finding finished-artwork images for ${todo.length} post(s)…`);
  for (const p of todo) await findArt(p);
  await fs.rm(TMP, { recursive: true, force: true });
}

const list = [...posts.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
const out = { updated: new Date().toISOString(), sources: { tiktok: tt || null, instagram: cfg.instagram || null }, posts: list };
await fs.mkdir(path.dirname(FEED), { recursive: true });
const before = JSON.stringify({ ...old, updated: null });
if (JSON.stringify({ ...out, updated: null }) !== before) await fs.writeFile(FEED, JSON.stringify(out, null, 2) + "\n");
else log("No changes.");

// summary of how posts sort with the current rules (same logic as the site)
const buckets = sortPosts(list, cfg.sort || [], { hide: cfg.hide || [] });
log(`Saved ${list.length} post(s): +${report.added} new, ${report.updated} refreshed.`);
for (const b of buckets) log(`  ${b.title}: ${b.posts.length}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Social sync\n${list.length} posts saved (+${report.added} new)\n\n` +
    buckets.map((b) => `- **${b.title}**: ${b.posts.length}`).join("\n") + (report.errors.length ? `\n\n⚠ problems: ${report.errors.join(", ")}` : "") + "\n");
}
