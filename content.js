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
    tagline: "paintings · drawings · digital art · photography · poetry · sketchbooks",
    slogan: "live life, live forever",
    bio: "Fury Blade Seif paints, draws, designs, shoots and writes, mostly in sketchbooks, often live on stream, one page at a time.",
    email: "sonofsomney@gmail.com",
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
       videos: false      keep this section out of the Videos tabs
     Edits here apply instantly — no re-sync needed.
     hide: posts with any of these hashtags never show.
     Hide or rename one post: edit it in social/feed.json
       ("hidden": true  /  "title": "...", "titleLocked": true).         */
  social: {
    tiktok: "lifeofseif",
    instagram: "furballtbb",
    limit: 80,                         // newest N TikToks to keep per sync
    instagramLimit: 600,               // Instagram: pull the whole history
    sort: [
      { id: "timelapse", title: "Timelapses", color: "#c6ff00",
        match: ["timelapse", "speedpaint", "speedpainting", "arttimelapse", "drawingtimelapse", "paintingtimelapse"],
        phrases: ["drawing timelapse", "painting timelapse", "drawing stream"] },
      { id: "flips", title: "Sketchbook flips", color: "#a77bff",
        match: ["sketchbooktour", "flipthrough", "sketchbookflip"],
        phrases: ["completed this sketchbook", "in its entirety", "first part", "part 2", "flip through"] },
      // digital comes before sketchbook: old Procreate posts also carry #sketch / #doodle
      { id: "digital", title: "Digital", color: "#ff8a00",
        match: ["procreate", "procreateart", "digitalart", "digitaldrawing", "digitalpainting", "digitalartist",
                "digitalillustration", "ibispaint", "pixelart", "picocad", "3drender", "adobeillustrator", "albumcover"] },
      { id: "sketchbook", title: "Sketchbook", color: "#00e0ff",
        match: ["sketchbook", "acrylicmarker", "acrylicmarkers", "posca", "marker", "sketch", "doodle", "scrawlvember", "inktober"] },
      { id: "paintings", title: "Paintings", color: "#ff3ea5",
        match: ["acrylicpainting", "oilpainting", "painting", "canvas", "artbattle", "gouache", "watercolor"] },
      { id: "drawings", title: "Drawings", color: "#f6f3ec",
        match: ["drawing", "drawings", "illustration", "ink", "pencil", "charcoal", "pen", "traditionalart", "fanart", "sbr", "jojo", "tattoo", "tattooflash"] },
      { id: "wearables", title: "Custom shirts", color: "#c6ff00",
        match: ["customshirt", "customclothing", "diycustomshirt", "customtshirts", "customtshirt", "handpainted"] },
      { id: "photography", title: "Photography", color: "#00e0ff",
        expandAll: true,                 // every photo of a multi-photo post gets its own card
      match: ["photography", "photo", "film", "filmphotography", "35mm", "super8", "streetphotography", "portraitphotography",
                "photographer", "shotoniphone", "filmbros", "naturephotography"] },
      { id: "poetry", title: "Poetry", color: "#f6f3ec", videos: false,   // poems live in Work → Poetry, not Videos
        match: ["poetry", "poem", "poems", "poet", "spokenword", "writing"] },
      // anything left from Instagram (TikToks without a match stay off the site)
      { id: "instagram", title: "More from Instagram", color: "#a77bff", platform: "instagram", match: "*" },
    ],
    keep: ["poetry"],                  // these tags beat hide (poems tagged #corecore still show)
    hide: ["corecore", "fitnessmotivation", "weightloss", "costume", "halloween", "memories", "vrmod"],
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
    title: "Be There — Gygas",
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
    words: ["PAINT", "SKETCH", "DRAW", "DESIGN", "PHOTOGRAPH", "WRITE", "REPEAT"],   // the words that rotate under your name
    colorChangeSeconds: 3.2,
  },

  /* ---------- Work ----------
     One Cover Flow carousel per skill, in this order. Each pulls the
     pictures from the feed sections above (from: [...]; "id@instagram" or
     "id@tiktok" takes only that platform's posts). paintings: true also adds
     the hand-picked series below. Videos stay in the Videos section, and a
     piece posted twice (video + photo) shows once.                         */
  work: [
    // match: hashtags (and the tags I added to untagged Instagram posts). A post goes to
    // the FIRST section that matches, in this order. To move one piece by hand, set
    // "section": "<id>" on it in social/feed.json.
    { id: "poetry",      title: "Poetry",      color: "#0d0d0d", blurb: "Words, sometimes with pictures. Tap one to read or play it.",
      poetry: true, match: ["poetry", "poem", "poems", "spokenword"] },
    { id: "digital",     title: "Digital art", color: "#ff8a00", blurb: "Procreate pieces, album covers and commissions.",
      match: ["procreate", "procreateart", "digitalart", "digitaldrawing", "digitalpainting", "digitalartist", "digitalillustration",
              "ibispaint", "pixelart", "picocad", "3drender", "adobeillustrator", "albumcover", "scrawlvember"] },
    { id: "photography", title: "Photography", color: "#00e0ff", blurb: "Shows, nights out and everything in between.",
      expandAll: true,                 // every photo of a multi-photo post gets its own card
      match: ["photography", "photo", "film", "filmphotography", "35mm", "super8", "streetphotography", "portraitphotography",
              "photographer", "shotoniphone", "filmbros", "naturephotography"] },
    { id: "paintings",   title: "Paintings",   color: "#ff3ea5", blurb: "Acrylic marker and canvas: sketchbook pages, art battles and the finished pieces from my streams.",
      paintings: true, match: ["painting", "acrylic", "acrylicpainting", "acrylicmarker", "acrylicmarkers", "canvas", "posca", "marker",
              "artbattle", "gouache", "watercolor", "oilpainting", "sketchbook"] },
    { id: "drawings",    title: "Drawings",    color: "#f6f3ec", blurb: "Ink, pencil crayon, Copic, tattoo flash and hand-drawn shirts.",
      match: ["drawing", "drawings", "illustration", "ink", "pencil", "charcoal", "pen", "traditionalart", "fanart", "tattoo",
              "tattooflash", "sketch", "doodle", "customshirt", "customclothing", "handdrawn"] },
  ],
  // the order the carousels show on the page
  workOrder: ["drawings", "digital", "paintings", "photography", "poetry"],


  /* ---------- Paintings ----------
     Each entry is a "series". Every series gets its own colour, and
     switching between series plays a paint-splash transition.
     items: one per painting. Only `image` and `title` are required.      */
  // Hand-picked series; they show in Work → Paintings (work → paintings: true).
  paintings: [
    {
      id: "canvas",
      title: "On canvas",
      blurb: "Acrylic paintings on stretched canvas.",
      color: "#ff8a00",
      ink: "#0d0d0d",
      items: [
        // note (optional): a line shown when the painting is opened full-screen
        { title: "Cyclepath", year: 2026, medium: "Acrylic on canvas", size: "5 × 7 in", image: "assets/paintings/cyclepath.jpg",
          note: "hell no i aint cycle" },
      ],
    },
    {
      id: "sketchbook-01",
      title: "Sketchbook 01 — selects",
      blurb: "Favourite pages from the September–October sketchbook.",
      color: "#00e0ff",      // background colour for this series
      ink: "#0d0d0d",        // text/silhouette colour on top of it
      items: [
        // link (optional): the TikTok/Instagram post this piece appears in
        { title: "Freighter at Dusk", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-05.jpg" },
        { title: "Moonrise over the Water", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-06.jpg" },
        { title: "House on the Hill", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-19.jpg" },
        { title: "Through the Window", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-07.jpg" },
        { title: "Flex", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-08.jpg" },
        { title: "Spring Canopy", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-10.jpg" },
        { title: "Ticket to Ride", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-13.jpg" },
        { title: "Waistband", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-11.jpg" },
        { title: "Rooftop Figure", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-02.jpg" },
        { title: "Swirl Head", year: 2026, medium: "Acrylic marker in sketchbook", image: "assets/sketchbooks/book-01/page-16.jpg" },
      ],
    },
  ],

  /* ---------- Sketchbooks ----------
     Put each sketchbook in its own folder, e.g. assets/sketchbooks/book-01/
       cover.jpg          front cover   (its shape sets the book's shape)
       back.jpg           back cover    (optional)
       page-01.jpg        first inside page
       page-02.jpg        ...
     then set `pages` to how many page images there are, and
     `size: [width, height]` in inches (measure the cover).
     Want different file names? Use `pageList: ["a.jpg", "b.png", ...]`
     instead of `pages`.                                                    */
  sketchbooks: [
    // size: [width, height] in inches — books show at their true size relative to each other
    // thickness: inches, covers included — the book keeps this thickness however many
    //            pages are uploaded (the rest shows as blank pages at the back)
    // hardcover: true gives the covers thick boards
    { id: "book-01", title: "Sketchbook 01", year: 2026, color: "#ff3ea5", folder: "assets/sketchbooks/book-01", pages: 19,
      size: [5.25, 8.25], thickness: 0.85, hardcover: true, note: "Sep – Oct 2026" },
    // Started Nov 2023. Page photos were taken recently, so their dates can't be used
    // for ordering — pages are numbered by hand (page-01, page-02, … in the order sent).
    { id: "book-02", title: "Sketchbook 02", year: 2023, color: "#ff8a00", folder: "assets/sketchbooks/book-02", pages: 131,
      size: [8.25, 10], thickness: 0.72, note: "Started Nov 2023",
      // Sticky notes you can lift: page number → the photo with the notes lifted,
      // plus one outline per note ([x, y] corners, 0–1 across / down the page).
      // Tapping a note peels it up to show that spot of the "lift" photo.
      // A tilted note: { points: [...], peel: 45 } — the direction it peels toward,
      // in degrees clockwise from straight up (default 0 = peels bottom → top).
      layers: {
        23: { lift: "page-23-lift.jpg", notes: [
          [[0, 0], [0.335, 0], [0.335, 0.405], [0, 0.405]],                   // pink note
          { points: [[0.52, 0.165], [0.70, 0.015], [0.91, 0.19], [0.76, 0.41]], peel: 45 },   // tilted note
          [[0.62, 0.455], [0.97, 0.455], [0.97, 0.735], [0.62, 0.735]],       // green note
        ] },
        // "Vultures": the pink note flips over to the right and hangs off the page.
        // overhang = the part of the lifted note past the page edge (width: fraction of the page width)
        111: { lift: "page-111-lift.jpg", notes: [
          { points: [[0.635, 0.655], [1, 0.655], [1, 0.965], [0.635, 0.965]], peel: 90,
            overhang: { image: "page-111-flap.png", width: 0.4 } },
        ] },
      } },
    // Pocket kraft notebook with the traffic-cone cover
    { id: "book-03", title: "Sketchbook 03", color: "#8f4fd6", folder: "assets/sketchbooks/book-03", pages: 58,
      size: [4.6, 7.5], thickness: 0.18, year: 2025, note: "Started Nov 2025 · NSFW",
      corner: 0.4,                         // rounded outer corners (radius, inches)
      nsfw: true,                          // asks for birth year before opening (18+)
      insideFront: "inside-front.jpg",     // art on the inside of the front cover
      insideBack: "inside-back.jpg",       // …and on the inside of the back cover
      endpaper: false, inside: "#b9916c" },   // plain kraft inside covers (inside: their colour)
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
    { type: "feed",  title: "Process timelapse", from: "timelapse" },    // random timelapse TikTok on every visit
    { type: "text",  title: "Now",               text: "Filling a page a day in the current sketchbook, with drawing streams most nights." },
    { type: "feed",  title: "From the sketchbook", from: "sketchbook" }, // random sketchbook post on every visit
    { type: "link",  title: "Email",             url: "mailto:sonofsomney@gmail.com", caption: "sonofsomney@gmail.com" },
    // Paste TikTok / Instagram post links here to embed them as cards:
    // { type: "tiktok",    title: "Process video", url: "https://www.tiktok.com/@lifeofseif/video/1234567890123456789" },
    // { type: "instagram", title: "New piece",     url: "https://www.instagram.com/p/XXXXXXXXXXX/" },
  ],
};
