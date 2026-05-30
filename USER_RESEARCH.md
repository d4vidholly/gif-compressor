# GifFit — User Research & Personas

Research date: May 2026. Sources: Discord statistics (DemandSage, SimilarWeb), Discord support forums, compression tool reviews, community articles.

---

## The audience in numbers

| Stat | Figure | Source |
|---|---|---|
| Monthly active users | 259.2 million | DemandSage 2026 |
| Registered users | 656 million | DemandSage 2026 |
| Age 18–24 (largest group) | 35.49% of traffic | SimilarWeb |
| Male users | 67.7% | Statista |
| US desktop vs mobile | 60% desktop / 40% mobile | SimilarWeb |
| US adults 18–34 on Discord | 37% | Statista |
| US students with accounts | 60% | Statista |
| Active servers | 32.6 million | DemandSage |
| Servers under 15 members | 90% | Statista |
| Non-gamers by 2026 | 55% estimated | DemandSage |
| Discord Nitro revenue (2023) | $207 million | DemandSage |
| Average monthly usage | 280 minutes | DemandSage |

**The wall everyone hits:** Discord animated emoji must be under 256 KB and exactly 128×128 pixels. Nitro raises upload limits to 500 MB but does NOT change the 256 KB emoji limit. Even paying users hit it.

---

## Persona 1 — The Server Curator

**Who:** Server admin, age 20–27, desktop user. Runs a gaming or hobby server with 100–2,000 members. Treats emoji as the server's personality — refreshes them seasonally, reacts to memes and game releases.

**Device:** Primarily desktop. Has multiple browser tabs open. Comfortable with tools but not a developer.

**Goal:** A polished, frequently updated emoji set that makes the server feel alive. Quality matters — blurry or banded emoji reflect badly on their server.

**Current behaviour:** Already knows ezgif. Uses it regularly. Finds the workflow frustrating — full page reloads, no download button, having to repeatedly tweak compression and re-download to find the right quality/size balance.

**Pain points:**
- The 256 KB limit is a constant ceiling
- No tool tells them "this is now 243 KB" before they download — they guess and iterate
- Compressing 10–20 emoji for a server refresh takes 2–8 hours of tedious work
- Batch processing doesn't exist anywhere on the free market

**Effort tolerance:** High — they're motivated, they'll push through friction. But they resent it.

**Quote:** "I spent 45 minutes getting 8 emoji under 256KB last week. There has to be a better way."

**Upgrade likelihood:** High. Batch processing is a direct pain point. Converts when they hit 10+ emoji in one session. Price tolerance: £3–5/month or £15 one-time.

---

## Persona 2 — The Impulse Reactor

**Who:** Regular user, age 16–23, mixed device. Just wants to share a GIF they found. No particular investment in the process — the GIF is just the best way to react to something right now.

**Device:** Mix of desktop and mobile. Increasingly mobile-first for younger end of this group.

**Goal:** Send the GIF before the moment passes. Speed is everything. Quality is fine — it's a reaction GIF.

**Current behaviour:** Hits "Upload failed: File is too large." Gets annoyed. ~60% give up immediately — sends a link, describes the GIF in text, or just moves on. The remaining 40% try to find a compression tool but have roughly 60 seconds of patience.

**Pain points:**
- Doesn't understand why a GIF is "too big"
- The fix involves too many steps
- The moment passes while they're sorting it out
- Mobile experience is completely broken

**Effort tolerance:** Very low. Three steps maximum. If the download isn't obvious, they leave.

**Quote:** "ugh its 9mb just gonna send it as a link"

**Upgrade likelihood:** No. But this is the largest segment by raw volume and the primary top-of-funnel. Some Reactors become Curators when they start their own servers.

---

## Persona 3 — The Creator/Producer

**Who:** Twitch streamer or YouTube creator, age 20–30, desktop. Has a Discord server as part of their community infrastructure. Emoji are subscriber rewards, brand touchpoints, inside jokes from streams.

**Device:** Desktop exclusively for this workflow.

**Goal:** A complete, on-brand emoji set deployed before or during a stream. Often working to a deadline. Time-poor, technically capable, and unforgiving of tools that waste their time.

**Current behaviour:** Creates GIFs from their own content (stream clips, reaction faces, branded graphics). Needs to compress batches of 10–30 files at once with consistent quality. Currently uses ezgif one file at a time or pieces together desktop tools.

**Pain points:**
- No batch tool exists on the free market
- Quality control is critical — won't accept degradation on their own face or brand
- The current multi-step workflow (clip → make GIF → compress → check quality → retry) takes hours
- No tool shows quality degradation before download

**Effort tolerance:** High — but time is money. Will pay to avoid the friction.

**Quote:** "I need to drop 20 new emotes before the stream tonight and they all need to be under 256KB."

**Upgrade likelihood:** Very high. Batch is non-negotiable. Price tolerance: £5–10/month, monthly subscription preferred. Most likely first-week converter.

---

## Persona 4 — The Mobile Scroller

**Who:** Casual user, age 16–21, phone-only. Primarily uses Discord on mobile. Sees content on TikTok or Reddit, wants to share it in Discord.

**Device:** Phone only. Doesn't have a desktop workflow.

**Goal:** Share something funny before the conversation moves on.

**Current behaviour:** Hits the file size limit. Has no viable mobile compression workflow — all tools are desktop-first. Most likely outcome: shares the link instead, or simply doesn't send it.

**Pain points:**
- The entire compression toolchain assumes a desktop
- Upload → compress → download → re-upload on mobile takes 10+ minutes if it works at all
- No tool is designed for the mobile Discord use case

**Effort tolerance:** Zero — on mobile, if it doesn't happen in two taps, it doesn't happen.

**Quote:** "why cant i just send gifs on my phone its so annoying"

**Upgrade likelihood:** No — but this is a greenfield. Whoever owns the mobile GIF compression experience owns the next generation of users. GifFit's responsive blueprint UI is already an advantage here.

---

## Journey map — The Server Curator (full path)

```
01  Finds a GIF or clips a video segment they want as a server emoji
02  Opens Discord → Server Settings → Emoji → Upload Emoji
03  "File too large. Maximum file size is 256 KB."
04  Googles "compress gif for discord" or "gif under 256kb"
05  Lands on a listicle or directly on ezgif     ← ~20% drop off here (confusion, ads)
06  Uploads to ezgif, sets compression level, hits Optimize
07  Full page reload. Scans for the output. Right-click → Save image as…
08  Checks file size in Finder/Explorer         ← ~15% drop off here
09  Still too large. Goes back. Increases compression. Downloads again.
10  Quality looks bad. Tries a different approach (reduce colors? resize?)  ← ~25% drop off
11  Eventually hits 243 KB. Returns to Discord. Re-uploads. Success.
12  Total time: 8–25 minutes per emoji. 20 emoji = 160–500 minutes.
```

The 40% who complete this process are the Server Curators. They are motivated enough to push through because the emoji matter to their server. But they resent every unnecessary step.

---

## Journey map — The Impulse Reactor (abandonment funnel)

```
01  Sees 9MB GIF on Reddit. Wants to share in Discord.
02  "Upload failed: File is too large."
~60% abandon — send link, describe in text, move on
03  Of the 40% who try: Google the problem. 60-second patience window.
04  Land on a tool. If it's confusing or slow: another ~30% abandon.
05  ~28% of the original group eventually compress and send.
    The conversation has usually moved on by then.
```

---

## Key design implications

**60 seconds or it's gone** — the Reactor has a 60-second window. The tool must produce a download in under a minute for a typical GIF. No page reloads. One clear button. File immediately available.

**The Discord Emoji preset IS the product** — the Curator doesn't want a quality slider as their primary interface. They want "make it fit as a Discord emoji" as a single button. The preset does the work; the slider is secondary.

**Quality floor transparency** — the Creator won't accept a blocky, banded version of their own face. Show the before/after at full resolution before download. If quality degrades past a threshold, surface a warning rather than silently producing garbage.

**Mobile is completely greenfield** — no tool is designed for the Mobile Scroller. A responsive, mobile-first GifFit would own this space. This is a year-two play but worth building for from day one.

**Batch is the upgrade trigger** — free tier converts on single files. The upgrade moment is "I have 20 emoji to compress." Batch is the one feature that should live behind paid — not quality, not file size, not speed.

**Nitro doesn't solve this** — Nitro subscribers still hit the 256 KB emoji wall. The addressable market is every Discord user who uploads emoji, not just the free tier.

---

## Upgrade scenarios

| Persona | Trigger | Price tolerance | Timeline |
|---|---|---|---|
| Server Curator | 10+ emoji in one session | £3–5/mo or £15 one-time | Week 2–4 of using free tier |
| Creator/Producer | Batch before a stream | £5–10/mo | Day 1 or 2 — need it now |
| Impulse Reactor | Never | N/A | Converts to Curator over time |
| Mobile Scroller | When mobile experience exists | £1–3/mo | Year 2 product play |

---

## Sources

- Discord Statistics 2026: DemandSage (demandsage.com/discord-statistics)
- Discord traffic analytics: SimilarWeb
- Discord server emoji requirements: discord.com/blog and support.discord.com
- Nitro features and pricing: discord.com/nitro, pumble.com/discord-pricing
- Discord GIF upload issues: support.discord.com community forums
- Compression workflow documentation: compresto.app, bulkpictools.com
- How to create Discord animated emoji: kapwing.com, filmora.wondershare.com
