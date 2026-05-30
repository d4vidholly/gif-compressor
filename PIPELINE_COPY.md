# GifFit — Pipeline Stage Copy & Animation Spec

Use this as the prompt for Claude Code to update the progress bar copy, blueprint box labels, and add conveyor belt animations.

---

## Tone reference

Deadpan industrial parody. The machinery is over-engineered for the task. Played completely straight — never winks. Short sentences. Workshop foreman who has seen things. See BRAND.md for full reference.

---

## The 4 stages — what actually happens

| Stage | Technical action | Duration |
|---|---|---|
| 01 | Palette quantization — each frame reduced from 256 colours down | ~30–40% of total time |
| 02 | Frame analysis — redundant/excess frames removed, rate reduced | ~30–40% of total time |
| 03 | LZW compression + target-size squeeze through output pipe | ~20–30% of total time |
| DONE | File confirmed within tolerance, ready for download | Instant |

---

## Progress bar text — above the bar, updates per stage

These are the sentences that appear in the status field above the progress bar. Sentence form. Deadpan. Include the technical detail — it builds trust.

```
STAGE 01 / PRESS
"Running colours through the press. 256 → 64."

STAGE 02 / TRIM
"Trimming the frames. No one will notice."

STAGE 03 / SQUEEZE
"Squeezing it through. Almost there."

COMPLETE
"Fit. [compressed_size]. The machinery did not break."
```

The `[compressed_size]` on completion is dynamic — replace with actual output e.g. "Fit. 243 KB. The machinery did not break."

---

## Blueprint box labels — inside the flowchart boxes

Short. All caps. Used as the header label inside each schematic node.

```
[INPUT]         → INTAKE
[Stage 01 box]  → COLOUR PRESS
[Stage 02 box]  → FRAME TRIMMER  
[Stage 03 box]  → OUTPUT STAGE
[Done node]     → APPROVED
```

Subtext inside each box (smaller, muted cyan):

```
INTAKE        → "material received"
COLOUR PRESS  → "palette under pressure"
FRAME TRIMMER → "excess removed"
OUTPUT STAGE  → "fitting to tolerance"
APPROVED      → "[compressed_size] · within spec"
```

---

## Stage vocabulary — adjectives and word bank

For use in copy, error states, UI labels, future content.

### Stage 01 — Colour Press
**Before:** saturated, bloated, chromatic, dense, raw, unprocessed  
**Action:** pressing, quantizing, stripping, reducing, refining  
**After:** reduced, compressed, lean, within palette  
**Technical terms:** palette, quantize, LZW, chromatic reduction, colour table

### Stage 02 — Frame Trimmer
**Before:** redundant, excessive, repetitive, bloated, padded  
**Action:** trimming, cutting, culling, removing, stripping  
**After:** trimmed, clean, tight, no excess, lean  
**Technical terms:** frame rate, frame count, keyframe, disposal, cadence

### Stage 03 — Output / Squeeze
**Before:** oversized, out of tolerance, non-compliant  
**Action:** squeezing, compressing, fitting, forcing through, calibrating  
**After:** within tolerance, to spec, compliant, approved, fit  
**Technical terms:** target size, tolerance, clearance, output, spec

### Complete
**Descriptors:** precise, approved, stamped, confirmed, within spec, compliant, ready  
**Workshop sign-off vocab:** approved, passed, stamped, cleared, fit for purpose, done

---

## Error state copy — same voice

```
FILE TOO LARGE
"Material exceeds intake tolerance. Max 50 MB. This is a gif compressor, not a miracle."

WRONG FILE TYPE  
"Unrecognised material. GIF files only. Feed it in again."

COMPRESSION FAILED
"The machinery encountered resistance. Try again."

QUALITY WARNING
"Heavy compression applied. Inspect output before uploading."

RATE LIMITED (future)
"The press needs a moment. Free limit reached."
```

---

## Animation spec — making the conveyor belt feel alive

No literal movement. The blueprint is a technical schematic — it doesn't animate like a cartoon. The animations should feel like a CRT display updating, or a control panel coming online. Industrial, not playful.

### 1. Stage activation — border brightens

When a stage becomes active, its box border transitions from dim to full cyan:

```css
.pipeline-box { border: 1px solid rgba(100,195,240,0.2); transition: border-color 0.4s ease; }
.pipeline-box.active { border-color: rgba(100,195,240,0.9); }
```

### 2. Connector line fill — trace animation

The dashed line connecting boxes "fills in" when the preceding stage completes. Use SVG `stroke-dashoffset` animation:

```css
.connector-line {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.6s ease;
}
.connector-line.complete {
  stroke-dashoffset: 0;
}
```

### 3. Stage label flicker — CRT on-switch

When a new stage label appears in the progress bar text area, it flickers in:

```css
@keyframes crt-on {
  0%   { opacity: 0; }
  10%  { opacity: 0.8; }
  15%  { opacity: 0.2; }
  25%  { opacity: 1; }
  100% { opacity: 1; }
}
.stage-label.new { animation: crt-on 0.35s ease forwards; }
```

### 4. Active box text — slow pulse

The subtext inside the active box pulses gently (not the border — just the small muted text):

```css
@keyframes blueprint-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}
.box-subtext.active { animation: blueprint-pulse 2s ease-in-out infinite; }
```

### 5. Completed box — stamp mark

When a stage completes, add a small `✓` or `DONE` annotation in the corner of the box. Fades in:

```css
@keyframes stamp-in {
  0%   { opacity: 0; transform: scale(1.4); }
  100% { opacity: 0.5; transform: scale(1); }
}
.box-stamp { animation: stamp-in 0.3s ease forwards; color: rgba(100,195,240,0.5); font-size: 9px; }
```

### 6. Output pipe — pressure pulse when Stage 03 active

The narrow output pipe (the tight gap at the right end of the schematic) pulses its border when Stage 03 is running — suggests something being forced through:

```css
@keyframes pipe-pressure {
  0%, 100% { border-color: rgba(100,195,240,0.3); }
  50%       { border-color: rgba(100,195,240,0.9); }
}
.output-pipe.active { animation: pipe-pressure 0.8s ease-in-out infinite; }
```

### 7. Progress bar fill

Simple linear fill from left to right as stages complete. Tie to stage number:

```
Stage 01 active  → bar at 15%
Stage 01 done    → bar at 33%
Stage 02 done    → bar at 66%
Stage 03 done    → bar at 95%
Complete         → bar at 100% (with brief pause before showing result)
```

---

## Prompt for Claude Code

```
Read PIPELINE_COPY.md and BRAND.md.

Update the compression pipeline UI with the following changes:

1. Progress bar text — update the 4 stage status messages to match 
   the copy in the "Progress bar text" section of PIPELINE_COPY.md.
   The final completion message must be dynamic: 
   "Fit. [actual compressed size]. The machinery did not break."

2. Blueprint box labels — update the schematic node labels and 
   subtext inside each flowchart box to match the "Blueprint box 
   labels" section.

3. Animations — implement all 7 animations from the "Animation spec" 
   section. CSS only where possible. Each animation must activate and 
   deactivate based on the current stage state from the status poll.

4. Error states — update all error message copy to match the 
   "Error state copy" section. These map to the existing error 
   handling in upload.js.

5. The active stage class (.active) should be set in upload.js as 
   the status poll receives each stage update from the API.

Keep all animations subtle. The schematic should feel like a 
control panel updating, not a game. Blueprint aesthetic throughout.
```

---

## Thumbnail + flanking box animation

### Layout concept

```
┌─────────────────┐          ┌──────────┐          ┌─────────────────┐
│  CURRENT STAGE  │          │          │          │   NEXT STAGE    │
│                 │◄────────►│ THUMBNAIL│◄────────►│                 │
│  COLOUR PRESS   │          │  [gif]   │          │  FRAME TRIMMER  │
│  palette: 64    │          │          │          │  frames: 12     │
└─────────────────┘          └──────────┘          └─────────────────┘
          ACTIVE                STATIC                    PENDING
```

The thumbnail never moves. It is the material under process. The flanking boxes are the machinery. The animation lives entirely in the boxes — the thumbnail is the fixed reference point that makes the box movement legible.

---

### Stage transition — the handoff

When a stage completes and the next begins, the boxes swap roles:

**Current box (left) → completing:**
- Border brightness drops from full to ~30% over 400ms
- A small `DONE` stamp fades in at bottom-right corner (opacity 0 → 0.5)
- Subtext updates to past tense: "palette reduced" (flicker-in)
- Box does not move

**Next box (right) → activating:**
- Border traces around the box clockwise using `stroke-dashoffset` — like a blueprint being drawn in real time (600ms)
- Subtext flickers in with CRT effect
- Becomes the new "current" box

**Between them — the thumbnail:**
- Does not animate during stage transitions
- Acts as the visual anchor that makes the left/right swap feel grounded
- On completion: swaps from the original GIF to the compressed result (the before→after moment)

---

### The press suggestion — boxes move fractionally inward

As compression progresses through stages, the two flanking boxes move fractionally closer to the thumbnail. Not a dramatic slide — just enough to suggest pressure being applied:

```
Stage 01 active:  boxes at default position
Stage 02 active:  boxes 4px closer to thumbnail
Stage 03 active:  boxes 8px closer to thumbnail (maximum)
Complete:         boxes retract to default — work done
```

```css
.current-box, .next-box {
  transition: transform 1.2s ease;
}
.stage-01 .current-box { transform: translateX(0); }
.stage-02 .current-box { transform: translateX(4px); }
.stage-03 .current-box { transform: translateX(8px); }
.stage-done .current-box { transform: translateX(0); }

.stage-01 .next-box { transform: translateX(0); }
.stage-02 .next-box { transform: translateX(-4px); }
.stage-03 .next-box { transform: translateX(-8px); }
.stage-done .next-box { transform: translateX(0); }
```

The thumbnail container must be `position: relative; z-index: 2` so boxes pass behind it visually if they get close.

---

### Scan line on thumbnail during processing

While compression is running, a single horizontal scan line moves slowly down the thumbnail. Suggests the machine is reading/measuring the material. Stops on completion.

```css
.thumbnail-wrap { position: relative; overflow: hidden; }

.thumbnail-wrap::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: rgba(100,195,240,0.4);
  top: 0;
  animation: scan 3s linear infinite;
}

.thumbnail-wrap.complete::after { display: none; }

@keyframes scan {
  0%   { top: 0%; opacity: 0; }
  5%   { opacity: 1; }
  95%  { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
```

---

### Data update inside boxes — numbers changing

As each stage runs, the stat line inside the box updates to show the live metric. These flicker in like a readout changing:

```
COLOUR PRESS box:
  "palette: 256"  →  "palette: 64"     (updates mid-stage)

FRAME TRIMMER box:
  "frames: 24"    →  "frames: 12"      (updates mid-stage)

OUTPUT STAGE box:
  "size: 2.1 MB"  →  "size: 243 KB"    (updates on completion)
```

These values come from the API response — use `original_dimensions`, `compressed_size`, and any intermediate data the status endpoint returns.

```css
@keyframes readout-change {
  0%   { opacity: 1; }
  30%  { opacity: 0; }
  60%  { opacity: 0; }
  100% { opacity: 1; }
}
.box-stat.updating { animation: readout-change 0.4s ease forwards; }
```

---

## Updated Claude Code prompt (replaces previous)

```
Read PIPELINE_COPY.md and BRAND.md.

Update the compression pipeline UI:

COPY CHANGES
1. Progress bar text — 4 stage messages as specified in 
   "Progress bar text" section. Completion message is dynamic:
   "Fit. [compressed_size]. The machinery did not break."
2. Blueprint box labels and subtext — as per "Blueprint box labels"
3. All error state copy — as per "Error state copy"

ANIMATION — EXISTING BOXES (from previous spec)
4. Stage activation border brightness
5. Connector line trace (stroke-dashoffset)
6. CRT flicker on stage label appear
7. Subtext pulse on active stage
8. Stamp mark on stage complete
9. Output pipe pressure pulse
10. Progress bar fill tied to stage number

ANIMATION — THUMBNAIL + FLANKING BOXES (new)
11. On stage transition: current box dims + DONE stamp, 
    next box border traces in clockwise
12. Both flanking boxes move 4px/8px toward the thumbnail 
    across stages 01/02/03, retract on complete
13. Thumbnail scan line (::after pseudo-element) during 
    processing, hidden on complete
14. Box stat lines (palette count, frame count, file size) 
    flicker-update mid-stage using readout-change animation

IMPLEMENTATION NOTES
- The thumbnail container must be z-index: 2 so boxes pass behind it
- Stage class (stage-01, stage-02, stage-03, stage-done) is set on 
  a parent wrapper element by upload.js during the status poll
- All values for box stats come from the API response fields: 
  original_dimensions, compressed_dimensions, original_size, 
  compressed_size
- No JavaScript animation libraries — CSS transitions and 
  @keyframes only
- Animations must respect prefers-reduced-motion
```
