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
    name: "YOUR NAME",                 // big name in the hero + browser tab
    tagline: "paintings · sketchbooks · extras",
    bio: "Painter & sketchbook hoarder. Swap this line for a short intro about you and your work.",
    email: "hello@example.com",
    socials: [
      { label: "Instagram", url: "https://www.instagram.com/furballtbb/" },
      { label: "TikTok",    url: "https://www.tiktok.com/@lifeofseif" },
    ],
  },

  /* ---------- Social feeds (auto-sorted) ----------
     Every day a GitHub Action pulls your posts, keeps each caption +
     hashtags and saves the cover images (see README → "Auto-sync").
     The site then files each post into the FIRST section below whose
     keywords match one of its #hashtags or a word in its caption.
       match: ["timelapse", ...]   keywords, without the #
       match: "*"                  everything that matched nothing else
       inPaintings: true           also show these covers in Paintings
                                   as a "Fresh from the feed" series
     Change the keywords any time — no re-sync needed.
     Hide a post: add its keyword to `hide`, or set "hidden": true on it
     in social/feed.json.                                                 */
  social: {
    tiktok: "lifeofseif",
    instagram: "furballtbb",
    limit: 80,                         // newest N posts to keep per sync
    sort: [
      { id: "timelapse",  title: "Timelapses", color: "#c6ff00", inPaintings: true,
        match: ["timelapse", "speedpaint", "speedpainting", "speeddraw", "speeddrawing", "arttimelapse", "paintingtimelapse",
                "drawingtimelapse", "process", "artprocess", "paintingprocess", "paintwithme", "drawwithme", "wip", "workinprogress"] },
      { id: "paintings",  title: "Paintings",  color: "#ff3ea5", inPaintings: true,
        match: ["painting", "paintings", "oilpainting", "acrylicpainting", "acrylic", "gouache", "watercolor", "watercolour",
                "canvas", "painter", "artwork", "finishedpiece", "traditionalart", "fineart"] },
      { id: "sketchbook", title: "Sketchbook", color: "#00e0ff",
        match: ["sketchbook", "sketchbooktour", "sketch", "sketching", "sketches", "drawing", "doodle", "doodles", "ink", "pencil", "illustration"] },
      { id: "more",       title: "More",       color: "#a77bff", match: "*" },
    ],
    hide: [],                          // e.g. ["personal", "ad"]
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
    { id: "book-01", title: "Sketchbook 01", year: 2025, color: "#ff3ea5", folder: "assets/sketchbooks/book-01", pages: 12, note: "Daily studies" },
    { id: "book-02", title: "Sketchbook 02", year: 2025, color: "#c6ff00", folder: "assets/sketchbooks/book-02", pages: 10, note: "Travel" },
    { id: "book-03", title: "Sketchbook 03", year: 2024, color: "#00e0ff", folder: "assets/sketchbooks/book-03", pages: 14, note: "Figure drawing" },
    { id: "book-04", title: "Sketchbook 04", year: 2024, color: "#ff8a00", folder: "assets/sketchbooks/book-04", pages: 8,  note: "Colour tests" },
    { id: "book-05", title: "Sketchbook 05", year: 2023, color: "#a77bff", folder: "assets/sketchbooks/book-05", pages: 12, note: "Ideas & notes" },
    { id: "book-06", title: "Sketchbook 06", year: 2023, color: "#f6f3ec", folder: "assets/sketchbooks/book-06", pages: 10, note: "Ink only" },
  ],

  /* ---------- Extras ----------
     A free-form grid for anything else: merch, zines, process videos,
     stickers, links, notes...
     type: "image" | "video" | "link" | "text"
       image → opens full-screen          (needs image)
       video → plays in a pop-up           (url: .mp4 file or YouTube link)
       link  → opens in a new tab          (url)
       text  → just a note card            (text)                           */
  extras: [
    { type: "image", title: "Sticker sheet",   image: "assets/extras/stickers.jpg", caption: "Die-cut stickers, 2025" },
    { type: "video", title: "Process timelapse", url: "assets/extras/process.mp4", image: "assets/extras/process-thumb.jpg" },
    { type: "link",  title: "Shop / prints",   url: "https://example.com", caption: "Prints & originals" },
    { type: "text",  title: "Now",             text: "Currently working on a new series. Commissions open from spring." },
    { type: "image", title: "Zine",            image: "assets/extras/zine.jpg", caption: "Risograph zine, 24pp" },
    { type: "link",  title: "Say hi",          url: "mailto:hello@example.com", caption: "Email me" },
    // Paste TikTok / Instagram post links here to embed them as cards:
    // { type: "tiktok",    title: "Process video", url: "https://www.tiktok.com/@lifeofseif/video/1234567890123456789" },
    // { type: "instagram", title: "New piece",     url: "https://www.instagram.com/p/XXXXXXXXXXX/" },
  ],
};
