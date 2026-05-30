# GifFit — Brand Brief

---

## The name

**GifFit**

Two meanings, both immediate:

1. **Fit as in fits** — your GIF now fits the file size limit. Fits in Discord. Fits in Slack. Fits on the page.
2. **Fit as in lean** — trimmed, optimised, no excess. The GIF has been through the machine.

**Domain:** `giffit.io` (primary) · `giffit.com` (defensive registration)
— giffit.com has no active product. giffit.io is clear.
— Avoid gif.fit — getgif.fit is a fitness platform.

---

## Tagline

**"Make your GIF fit."**

An instruction, not a promise. The product name is already in the sentence.
Say it aloud: *"Make your GIF fit with GifFit."* Reads like it was always the name.

Do not use: "Get your GIF fit" — doesn't land the same way.

---

## Tone of voice

**Deadpan industrial parody.**

GifFit treats compressing a 2 MB Discord emoji as a serious industrial operation requiring a full precision production pipeline. The machinery is completely over-engineered for the task. This is played absolutely straight — never wink at it, never break character. The contrast between the infrastructure and the triviality of the task is the joke.

**Reference points:**
- Aperture Science (Portal) — overly corporate science voice applied to absurd tasks
- Hydraulic Press Channel — industrial equipment, tiny objects, complete seriousness

**Rules:**
- Exclamation marks are banned
- Never say "easy", "simple", "seamless", "powerful", "just", or "simply"
- Short sentences. The foreman doesn't repeat himself.
- Numbers are always precise. "243 KB" not "about 250 KB".
- The machinery is never wrong. If something fails, it's the material's fault.

**Never say:**
- "Easy and seamless"
- "Simply upload your file"
- "Optimised for you"
- "Get started for free"
- "Powerful yet simple"

---

## Copy

### Hero

```
MAKE YOUR GIF FIT.

We built a precision compression rig.
For your GIF.
You're welcome.
```

### Drop zone

```
FEED MATERIAL INTO INTAKE.
gif only · max 50 MB free · no hard hats required
```

### Preset buttons (tolerance labels)

```
DISCORD          8 MB clearance
DISCORD EMOJI    256 KB tolerance
SLACK EMOJI      128 KB tolerance
WEB              1 MB spec
```

### Pipeline stage labels (during compression)

```
STAGE 00   Material received. Assessing the situation.
STAGE 01   Running colours through the press. 256 → 64.
STAGE 02   Trimming the frames. No one will notice.
STAGE 03   Squeezing it through. Almost there.
COMPLETE   Fit. 243 KB. The machinery did not break.
```

### After compression

```
Job complete.
243 KB. Down from 5.4 MB.
The machinery did its job.
```

### Error: file too large

```
Material exceeds intake tolerance.
Max 50 MB on the free tier. 150 MB for Pro. This is a gif compressor, not a miracle.
```

### Error: wrong file type

```
Unrecognised material.
GIF files only. Feed it in again.
```

### Rate limit hit

```
The press needs a moment.
Free limit reached. The machinery never stops for paid users.
```

### Footer

```
Output material deleted from facility after 60 minutes.
```

---

## Visual identity

**Theme:** Blueprint schematic. Engineering drawing. The pipeline is a technical diagram of the production process.

**Background:** Dark navy `#0d1f35`  
**Lines / primary:** Cyan `#64c3f0`  
**Grid:** Fine cyan grid at 6% opacity — standard blueprint paper  
**Border:** Inset double border, 1.5px cyan at 30% opacity  
**Title block:** Bottom bar with project name, drawn by, scale, sheet, status

**No colour accents. No gradients. No illustrations beyond the schematic linework.**

---

## Typography

Three-tier system. All available free on Google Fonts.

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display / hero | Bebas Neue | 400 | Heavily condensed — the letters are literally compressed |
| Labels / presets / subheads | Barlow Condensed | 500–600 | Technical, readable, uppercase |
| UI / body / stage copy | IBM Plex Mono | 400–500 | Blueprint register, schematic labels |

**The concept:** Bebas Neue is one of the most horizontally compressed display fonts available. The type itself has been reduced. Every time someone reads the headline they're looking at compressed letterforms. The font is the product.

**Case:** Bebas Neue is always uppercase by nature. Barlow Condensed labels in uppercase. IBM Plex Mono body in sentence case.

---

## The pipeline UI

The compression progress area below the drop zone renders as an animated blueprint schematic:

```
[INPUT] ──press──> [COLOUR REDUCED] ──trim──> [FRAMES CUT] ──squeeze──> [|pipe|] → OUTPUT
```

- The file enters as a large block on the left
- Passes through three labelled stages (each animates as it activates)
- Squeezes through a narrow output pipe sized to the chosen tolerance
- Exits small on the right
- Stage label copy updates in real time as each stage runs

The pipe width visually changes per preset — the Discord Emoji pipe is a tight gap, the Discord 8MB pipe is wide. The file visually has to squeeze harder for tighter tolerances.

**Title block** at the bottom of the schematic:
```
project: giffit · drawn by: system · scale: 1:1 (bytes) · sheet: 1 of 1 · status: approved
```

---

## SEO metadata

**Title tag:** `GifFit — Free GIF Compressor for Discord, Slack & Web`  
**Meta description:** `Compress animated GIFs to any size — Discord (8 MB), Discord emoji (256 KB), Slack emoji (128 KB). Free, no watermark, no account. Make your GIF fit.`  
**OG title:** `GifFit — Make your GIF fit.`

### Target keywords

| Keyword | Priority |
|---|---|
| gif compressor | Primary — H1, title tag |
| gif compressor for discord | Primary — subtitle, preset label |
| compress gif under 256kb | Secondary — preset label, blog |
| compress gif online free | Secondary — meta description |
| gif optimizer | Secondary — meta, footer |
| reduce gif file size | Tertiary — blog |
| slack emoji gif size | Tertiary — blog |

### Blog posts (write these first — high SEO value, low competition)

1. "How to compress a GIF under 256 KB for Discord emoji"
2. "How to compress a GIF under 8 MB for Discord"
3. "Why GIFs are so big (and how to fix it)"

---

## Competitive positioning

| | ezgif | GifFit |
|---|---|---|
| Ads | Heavy | None |
| Watermark | None | None |
| Target-size mode | No | Yes — presets + custom |
| Platform presets | No | Discord · Discord Emoji · Slack · Web |
| Interface | Cluttered, multi-tool | Single function |
| Visual theme | Dated | Blueprint schematic |
| Privacy | Server-side, no deletion policy | Deleted after 60 min |
| Account required | No | No |
| Tone | None | Deadpan industrial |

---

## One-paragraph press / about copy

> GifFit is a GIF compressor that does one thing: makes your GIF fit where it needs to go. Pick a platform — Discord, Discord emoji, Slack, or the web — and the compression rig handles the rest. No ads, no watermarks, no account. The output is deleted after an hour. It's the tool ezgif should have built in 2024, rendered as a precision engineering schematic, because someone had to.
