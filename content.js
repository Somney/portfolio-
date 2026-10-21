/* ==========================================================================
   CONTENT.JS  —  the only file you need to edit to update the portfolio.
   --------------------------------------------------------------------------
   • Text, colours, paintings, sketchbooks and extras all live here.
   • Image paths are relative to the site root (this folder).
   • Anything missing (a typo'd path, an image you haven't uploaded yet)
     shows an auto-generated placeholder instead of breaking the page.
   See README.md for step-by-step "how do I add X" instructions.
   ========================================================================== */

export default {
  /* ---------- About you ---------- */
  artist: {
    name: "Fury Blade Seif",               // big name in the hero + browser tab
    tagline: "paintings · sketchbooks · extras",
    bio: "Painter & sketchbook hoarder. Swap this line for a short intro about you and your work.",
    email: "hello@example.com",
    socials: [
      { label: "Instagram", url: "https://www.instagram.com/furballtbb/" },
      { label: "TikTok",    url: "https://www.tiktok.com/@lifeofseif" },
    ],
  },

  /* ---------- Social feeds (auto-sorted) ----------
     Every day a GitHub Action pulls your TikToks, keeps each caption +
     hashtags and saves the cover images (see README → "Auto-sync").
     The site files each post into the FIRST section below that matches:
       match:   hashtags (without the #) — the main way posts are sorted
       phrases: optional caption phrases, e.g. "completed this sketchbook"
       match: "*"         would collect everything left over (off for now,
                          so personal posts stay off the portfolio)
       inPaintings: true  also show these covers in Paintings as the
                          "Fresh from the feed" series
     Edits here apply instantly — no re-sync needed.
     hide: posts with any of these hashtags never show.
     Hide or rename one post: edit it in social/feed.json
       ("hidden": true  /  "title": "...", "titleLocked": true).         */
  social: {
    tiktok: "lifeofseif",
    instagram: "furballtbb",
    limit: 80,                         // newest N posts to keep per sync
    sort: [
      { id: "timelapse", title: "Timelapses", color: "#c6ff00", inPaintings: true,
        match: ["timelapse", "speedpaint", "speedpainting", "arttimelapse", "drawingtimelapse", "paintingtimelapse"],
        phrases: ["drawing timelapse", "painting timelapse", "drawing stream"] },
      { id: "flips", title: "Sketchbook flips", color: "#a77bff",
        match: ["sketchbooktour", "flipthrough", "sketchbookflip"],
        phrases: ["completed this sketchbook", "in its entirety", "first part", "part 2", "flip through"] },
      { id: "sketchbook", title: "Sketchbook", color: "#00e0ff",
        match: ["sketchbook", "acrylicmarker", "acrylicmarkers", "posca", "marker", "sketch", "doodle"] },
      { id: "paintings", title: "Paintings", color: "#ff3ea5", inPaintings: true,
        match: ["acrylicpainting", "oilpainting", "painting", "canvas", "artbattle", "gouache", "watercolor"] },
      { id: "digital", title: "Digital", color: "#ff8a00",
        match: ["procreate", "digitalart", "fanart", "illustration", "drawing", "drawings", "sbr", "jojo"] },
    ],
    hide: ["poetry", "corecore", "fitnessmotivation", "weightloss", "costume", "halloween", "memories", "vrmod"],
  },

  /* ---------- Background music ----------
     Starts on the visitor's first tap (browsers block sound before that).
     file:    upload the song to assets/music/ (mp3 or m4a) and put its
              path here — plays instantly with NO ads. Used first.
     youtube: fallback if there's no file. YouTube may play an ad before
              the song; a website can't turn those off.
     volume: 0–100.  title / cover: optional (cover = image path).        */
  music: {
    file: "assets/music/song.mp3",
    youtube: "https://youtu.be/fFMYua37UGQ",
    volume: 35,
    title: "",
  },

  /* ---------- Glitch overlay ----------
     Short bitmap-collage glitch bursts over the page, built from fresh
     public-domain art (Art Institute of Chicago), random free photos
     (Lorem Picsum) and your own TikTok artwork, crushed into two-tone
     dithered "plates" in your palette. A few pieces linger at the edges.
     enabled: false turns it off · intensity: 0.5 calmer … 2 wild
     stock: false = only use your own art · refreshSeconds: new image rate */
  glitch: {
    enabled: true,
    intensity: 1,
    stock: true,
    refreshSeconds: 20,
  },

  /* ---------- Look & feel ----------
     palette: the neon colours the hero cycles through (iPod-ad style).
     ink:     the "silhouette" colour used for all the two-tone shapes.
     paper:   off-white used for text on dark backgrounds.              */
  theme: {
    palette: ["#c6ff00", "#ff3ea5", "#00e0ff", "#ff8a00", "#a77bff"],
    ink: "#0d0d0d",
    paper: "#f6f3ec",
  },

  /* ---------- Hero (top of page) ----------
     silhouetteImage: optional PNG with a transparent background (e.g. a
     photo of you cut out). It gets turned into a solid-black silhouette.
     Leave as null to use the animated dancing figure.                     */
  hero: {
    silhouetteImage: null,
    words: ["PAINT", "SKETCH", "REPEAT"],   // the words that rotate under your name
    colorChangeSeconds: 3.2,
  },

  /* ---------- Paintings ----------
     Each entry is a "series". Every series gets its own colour, and
     switching between series plays a paint-splash transition.
     items: one per painting. Only `image` and `title` are required.      */
  paintings: [
    {
      id: "series-one",
      title: "Series One",
      blurb: "A short line about this body of work.",
      color: "#c6ff00",      // background colour for this series
      ink: "#0d0d0d",        // text/silhouette colour on top of it
      items: [
        // link (optional): the TikTok/Instagram post this piece appears in
        { title: "Untitled I",   year: 2025, medium: "Oil on canvas",     size: "60 × 80 cm", image: "assets/paintings/series-one-01.jpg", link: "" },
        { title: "Untitled II",  year: 2025, medium: "Oil on canvas",     size: "50 × 50 cm", image: "assets/paintings/series-one-02.jpg" },
        { title: "Untitled III", year: 2024, medium: "Acrylic on panel",  size: "40 × 60 cm", image: "assets/paintings/series-one-03.jpg" },
        { title: "Untitled IV",  year: 2024, medium: "Oil on linen",      size: "90 × 120 cm", image: "assets/paintings/series-one-04.jpg" },
        { title: "Untitled V",   year: 2024, medium: "Gouache",           size: "A3",          image: "assets/paintings/series-one-05.jpg" },
      ],
    },
    {
      id: "series-two",
      title: "Series Two",
      blurb: "Another series, another colour.",
      color: "#ff3ea5",
      ink: "#0d0d0d",
      items: [
        { title: "Study in Pink", year: 2024, medium: "Oil on canvas", size: "30 × 40 cm", image: "assets/paintings/series-two-01.jpg" },
        { title: "Night Swim",    year: 2024, medium: "Oil on canvas", size: "70 × 70 cm", image: "assets/paintings/series-two-02.jpg" },
        { title: "Static",        year: 2023, medium: "Acrylic",       size: "50 × 70 cm", image: "assets/paintings/series-two-03.jpg" },
        { title: "Afterglow",     year: 2023, medium: "Oil on panel",  size: "20 × 25 cm", image: "assets/paintings/series-two-04.jpg" },
      ],
    },
    {
      id: "series-three",
      title: "Series Three",
      blurb: "Commissions, studies, whatever you like.",
      color: "#00e0ff",
      ink: "#0d0d0d",
      items: [
        { title: "Blue Hour",  year: 2023, medium: "Watercolour", size: "A4", image: "assets/paintings/series-three-01.jpg" },
        { title: "Coolant",    year: 2023, medium: "Oil",         size: "40 × 40 cm", image: "assets/paintings/series-three-02.jpg" },
        { title: "Signal",     year: 2022, medium: "Mixed media", size: "60 × 90 cm", image: "assets/paintings/series-three-03.jpg" },
        { title: "Low Tide",   year: 2022, medium: "Oil",         size: "30 × 30 cm", image: "assets/paintings/series-three-04.jpg" },
        { title: "Receiver",   year: 2022, medium: "Acrylic",     size: "50 × 60 cm", image: "assets/paintings/series-three-05.jpg" },
      ],
    },
  ],

  /* ---------- Sketchbooks ----------
     Put each sketchbook in its own folder, e.g. assets/sketchbooks/book-01/
       cover.jpg          front cover   (its shape sets the book's shape)
       back.jpg           back cover    (optional)
       page-01.jpg        first inside page
       page-02.jpg        ...
     then set `pages` to how many page images there are.
     Want different file names? Use `pageList: ["a.jpg", "b.png", ...]`
     instead of `pages`.                                                    */
  sketchbooks: [
    { id: "book-01", title: "Sketchbook 01", year: 2026, color: "#ff3ea5", folder: "assets/sketchbooks/book-01", pages: 19, note: "Sep – Oct 2026" },
    { id: "book-02", title: "Sketchbook 02", year: 2025, color: "#c6ff00", folder: "assets/sketchbooks/book-02", pages: 10, note: "Travel" },
    { id: "book-03", title: "Sketchbook 03", year: 2024, color: "#00e0ff", folder: "assets/sketchbooks/book-03", pages: 14, note: "Figure drawing" },
    { id: "book-04", title: "Sketchbook 04", year: 2024, color: "#ff8a00", folder: "assets/sketchbooks/book-04", pages: 8,  note: "Colour tests" },
    { id: "book-05", title: "Sketchbook 05", year: 2023, color: "#a77bff", folder: "assets/sketchbooks/book-05", pages: 12, note: "Ideas & notes" },
    { id: "book-06", title: "Sketchbook 06", year: 2023, color: "#f6f3ec", folder: "assets/sketchbooks/book-06", pages: 10, note: "Ink only" },
  ],

  /* ---------- Extras ----------
     A free-form grid for anything else: merch, zines, process videos,
     stickers, links, notes...
     type: "image" | "video" | "link" | "text" | "feed"
       feed  → a random post from a Videos group each visit (from: group id, e.g. "timelapse")
       image → opens full-screen          (needs image)
       video → plays in a pop-up           (url: .mp4 file or YouTube link)
       link  → opens in a new tab          (url)
       text  → just a note card            (text)                           */
  extras: [
    { type: "image", title: "Sticker sheet",   image: "assets/extras/stickers.jpg", caption: "Die-cut stickers, 2025" },
    { type: "feed",  title: "Process timelapse", from: "timelapse" },   // random timelapse TikTok on every visit
    { type: "link",  title: "Shop / prints",   url: "https://example.com", caption: "Prints & originals" },
    { type: "text",  title: "Now",             text: "Currently working on a new series. Commissions open from spring." },
    { type: "image", title: "Zine",            image: "assets/extras/zine.jpg", caption: "Risograph zine, 24pp" },
    { type: "link",  title: "Say hi",          url: "mailto:hello@example.com", caption: "Email me" },
    // Paste TikTok / Instagram post links here to embed them as cards:
    // { type: "tiktok",    title: "Process video", url: "https://www.tiktok.com/@lifeofseif/video/1234567890123456789" },
    // { type: "instagram", title: "New piece",     url: "https://www.instagram.com/p/XXXXXXXXXXX/" },
  ],
};
