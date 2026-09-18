# Drawn balloons — design

**Status:** approved look (mockups shown and accepted on 2026-09-18); this spec turns it into Wubble code.
**Reference mockup:** `docs/superpowers/specs/inputs/drawn-balloon-mockup.ts.txt` — a throwaway script that drew the accepted look. It is a reference for the geometry, not code to copy.

## Why

The `speech` body is a rounded rectangle: at `cornerRadius` 0.9 it is a pill with long straight sides. Every balloon on a page has the same pill, the line has one weight all round, and the `hand` edge adds a small shake that reads as unsteady rather than drawn. At page size the result looks like an app's chat bubble laid on a picture.

A drawn comic balloon is an oval or a pillow shaped around its text, in an ink line that swells and thins. Its tail is drawn to show how the line is spoken.

## What changes

A style may choose a **drawn body**: `body: "drawn"` in `PROFILE.styles` / `RenderOptions.styles` / `--config`. The default stays `"rounded"`, so nothing changes for a project that does not ask for it.

A drawn balloon has four parts.

### 1. Body: an oval or a pillow around the text

- The body is a superellipse `|x/a|^n + |y/b|^n = 1` centred on the placement's centre.
- The exponent follows the text: `n = 2.2 + 0.7 · min(1, (lines − 1) / 2)`, plus a per-balloon offset in ±0.15. One line gives an oval; three or more lines give a pillow.
- `a` and `b` are the smallest axes that hold every line box, padded by `0.42 · fontSize` sideways and `0.23 · fontSize` above and below; `b` then grows by 4 % so the text does not touch the top and bottom.
- A low-frequency irregularity (radius × `1 + 0.012 · (0.6 sin(2t + φ1) + 0.4 sin(3t + φ2))`) and a tilt within ±1.4° keep two balloons from looking stamped. No high-frequency shake.

### 2. Line breaks: the smallest balloon wins

When the text is not authored as `lines`, the drawn body re-breaks it at the fitted font size: every split into 1–4 lines is measured, and the split whose body has the smallest area wins. A body wider than 2.4 × its height or narrower than 1.3 × pays a penalty of `(ratio / limit)²`. The font size still comes from the existing fitter. Authored `lines` are kept as written.

### 3. Ink line: thick and thin

- The line is drawn as a filled ring outside the body: the outer edge is the body offset along its normal by `w(θ) = strokeWidth · (1 + 0.45 · (normal · light))`, with `light` pointing down and to the right `(0.6, 0.8)`. The line is heavier bottom-right and lighter top-left.
- `strokeWidth` is the mean weight.

### 4. Tail: variation and mood

- The tail is a cubic spine from inside the body to the tip. Its width tapers from the throat to zero at the tip, and its ink tapers from the body's line weight to `0.2 · strokeWidth`.
- The throat half-width is `clamp(9, 0.045 · 2a, 0.3 · b)` times the mood's throat factor.
- The spine leaves between square to the edge and straight at the speaker (`lean`), bends to the tip, and may sway to one side (`sway`); a sway also bends the first half the other way, which makes a soft S rather than an elbow.
- **Mood** is set per balloon on the tail: `"tail": { …, "mood": "calm" | "urgent" | "hesitant" }`. The default is `calm`.

| Mood       | Throat | Lean | Sway | Taper exponent | Reads as                         |
| ---------- | ------ | ---- | ---- | -------------- | -------------------------------- |
| `calm`     | 1.0    | 0.42 | 0.03 | 1.0            | ordinary speech                  |
| `urgent`   | 1.5    | 0    | 0    | 1.9            | a shout, an alarm, a quick reply |
| `hesitant` | 0.6    | 0.3  | 0.16 | 0.75           | quiet, unsure or trailing speech |

- **Natural variation:** throat ±12 %, lean ±0.12 (not for `urgent`), sway ±0.03, and the sway side come from the balloon's own seed.
- `bend` is honoured as the spine's second control point.

### Seed and determinism

Every per-balloon variation comes from one seed: a hash of the item id and the rendered text. The same manifest, locale and revision render byte-identical SVG, as today.

### Output

A drawn balloon renders as one group with two paths, then the text:

```xml
<g id="…" data-shape="speech" data-style="dialogue" data-body="drawn">
  <path data-part="ink" d="…" fill="{stroke}"/>      <!-- ring + tail ink -->
  <path data-part="balloon" d="…" fill="{fill}"/>    <!-- body + tail fill -->
  <g data-part="text">…</g>
</g>
```

Each path is closed Catmull-Rom curves converted to cubic Béziers, with every subpath wound the same way so the nonzero fill rule unions them. The fill path covers the seam where the tail enters the body.

### Where the drawn body does not apply

A drawn style still falls back to the rounded builder for an item that sets `edge: "jagged"`, `notchTop`, or `lobes`. Those are bursts and chains, and they keep their current geometry. Reference-sheet shapes are unchanged.

### Validation

- Body bounds for a drawn balloon are the ink's bounding box. `OUT_OF_BOUNDS`, overlaps, exclusion zones and `TAIL_TOO_SHORT` use them.
- The schema accepts `tail.mood` (enum). The config accepts `body` (`rounded` | `drawn`) and `fill` (`#rrggbb`) per style.

## Opting in

A project turns it on in its own config, for example `"styles": { "dialogue": { "body": "drawn", "fill": "#ffffff", "strokeWidth": 4.5 } }`. Emphasis belongs in the text (capitals, where the project wants them); the renderer does not restyle words.

## Tests

- Body holds every line box; one line is an oval (`n` < 2.4), three lines a pillow (`n` > 2.7).
- Line breaks: a three-clause line breaks with its longest line in the middle; a short line stays one line; authored `lines` are kept.
- Ink ring is thicker at the bottom-right than at the top-left.
- Moods: `urgent` has the straightest spine and the widest throat; `hesitant` has the narrowest throat and a spine that crosses its own chord (an S).
- Variation: two balloons with different text differ; one balloon renders byte-identical twice.
- Config accepts `body` and `fill` and refuses bad values; schema accepts `tail.mood` and refuses an unknown mood.
- Jagged, notched and chained items in a drawn style keep the rounded builder.
- Validation uses the drawn bounds.
