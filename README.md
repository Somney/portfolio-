# Portfolio

A y2k / iPod-ad style art portfolio: neon two-tone colours, a dancing silhouette, paint-splash transitions, a Cover Flow paintings gallery, 3D sketchbooks you can actually flip through, and an extras grid.

No build step and no install. It's plain HTML/CSS/JS, and three.js is bundled in `js/vendor/`.

---

## Updating the site (the short version)

1. **Upload images** into the `assets/` folders. You can do this on github.com with *Add file → Upload files*.
2. **Edit `content.js`**. Every bit of text, colour, painting, sketchbook and extra lives in that one file.
3. Commit. If GitHub Pages is on, the site updates in about a minute.

If an image is missing or a path has a typo, the site draws a placeholder in its place, so nothing breaks.

---

## Add a painting

1. Upload the image to `assets/paintings/`, for example `assets/paintings/sunset.jpg`.
2. In `content.js`, find the series you want under `paintings:` and add a line to its `items`:

```js
{ title: "Sunset", year: 2026, medium: "Oil on canvas", size: "50 × 70 cm", image: "assets/paintings/sunset.jpg" },
```

**New series:** copy a whole `{ id: ..., title: ..., color: ..., items: [...] }` block and give it a new `id`, title and `color`. A tab for it shows up automatically, and switching tabs plays the paint-splash.

## Add a sketchbook

1. Make a folder, e.g. `assets/sketchbooks/book-07/`, and upload:
   - `cover.jpg`: the front cover. Its shape sets the book's shape.
   - `back.jpg`: the back cover (optional).
   - `page-01.jpg`, `page-02.jpg`, … : the inside pages in order. Two-digit numbers.
2. Add a line under `sketchbooks:` in `content.js`:

```js
{ id: "book-07", title: "Sketchbook 07", year: 2026, color: "#ff3ea5", folder: "assets/sketchbooks/book-07", pages: 16, note: "Summer" },
```

`pages` is how many page images there are. `.png` and `.webp` files work too, even if the name you wrote ends in `.jpg`.
If your files have other names, use `pageList: ["front.jpg", "scan1.png", ...]` instead of `pages`.

Page order in the book: page 1 is on the right after you open the cover, then 2 | 3, 4 | 5, and so on.

**Tips for scans:** crop each page to the same size as the cover, and keep each file under about 1500px tall / 400 KB so books open fast.

**Share a book directly:** `yoursite.com/#sketchbook/book-01` opens that book, and `#sketchbook/book-01/3` opens it partway through.

## Add an extra

Under `extras:` add one of:

```js
{ type: "image", title: "Zine", image: "assets/extras/zine.jpg", caption: "24pp riso" },
{ type: "video", title: "Timelapse", url: "https://youtu.be/XXXX", image: "assets/extras/thumb.jpg" }, // or a .mp4 path
{ type: "link",  title: "Shop", url: "https://...", caption: "Prints" },
{ type: "text",  title: "Now", text: "Working on..." },
```

## TikTok & Instagram

In `content.js`, the `social` block holds your usernames (`lifeofseif` on TikTok, `furballtbb` on Instagram):

- **TikTok:** a "Latest on TikTok" block under Extras shows your newest videos automatically.
- **Instagram:** a follow card links to your profile. Instagram has no official way to auto-show a whole profile.
- **Embed one post:** copy its link (Share → Copy link) and add it to `extras`:

```js
{ type: "tiktok",    title: "Process video", url: "https://www.tiktok.com/@lifeofseif/video/1234567890123456789" },
{ type: "instagram", title: "New piece",     url: "https://www.instagram.com/p/ABC123xyz/" },
```

- **Credit a painting to its post:** add `link: "<post url>"` to the painting. Its full-screen view then shows a "View on Instagram / Watch on TikTok" button.

Embeds only appear on the real site (GitHub Pages or your local preview), not inside the Claude Artifact preview.

## Change colours, name, hero

- `artist`: your name, bio, email, socials.
- `theme.palette`: the neon colours the hero cycles through. `theme.ink` is the silhouette colour.
- `hero.silhouetteImage`: put a cut-out PNG with a transparent background (e.g. a photo of you) in `assets/` and set its path here. It becomes a solid black silhouette that replaces the dancing figure.
- Fonts: the `--display` / `--body` variables at the top of `css/style.css`, plus the Google Fonts link in `index.html`.

---

## Preview locally

The site uses JavaScript modules, so opening `index.html` by double-clicking won't work. Run a tiny local server instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish free on GitHub Pages

Go to repo **Settings → Pages**, set **Source** to "Deploy from a branch", choose your main branch and `/ (root)`, then save.

---

## How it's put together

| File | What it does |
|---|---|
| `content.js` | **All your content. The only file you normally edit.** |
| `index.html` | Page skeleton |
| `css/style.css` | All styling |
| `js/main.js` | Hero, paintings Cover Flow, extras, iPod menu, lightbox, navigation |
| `js/splash.js` | Paint-splash transition engine |
| `js/dancer.js` | Animated iPod-ad silhouette |
| `js/sketchbooks.js` | 3D desk of books + page-flip viewer (three.js) |
| `js/sound.js` | Synthesized click-wheel and page-flip sounds |
| `js/util.js` | Helpers and placeholder art |

Ways to interact:
- Click the hero to splash a new colour.
- The chrome iPod button (top right) opens a menu. Spin the click wheel to move through it.
- In a sketchbook, drag a page corner, tap the left/right edges, use the ← → keys, or double-tap a page to zoom.
