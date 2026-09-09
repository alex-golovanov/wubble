# Wubble format handbook

Practical guide to authoring page manifests for **wubble** — the deterministic comic-lettering engine. Schema version **`0.1.0`**. Living companions: [`schemas/page.schema.json`](schemas/page.schema.json) and [`src/types.ts`](src/types.ts). Historical product contract: [`SPEC.md`](SPEC.md).

Wubble turns one placement manifest into separate language-specific transparent SVG balloon overlays. A human or LLM may author the manifest; **wubble alone** owns geometry, font measurement, validation, and SVG serialization. It never invents dialogue and never redraws the comic art.

---

## 1. Manifest overview

A page manifest is JSON (UTF-8) that declares:

| Field | Role |
| --- | --- |
| `schemaVersion` | Must be `"0.1.0"` |
| `pageId` | Stable page id |
| `coordinateSpace` | Art pixel grid (shared with the text-free master) |
| `renderProfile` | Typography / shape profile (`rift-city-proof` @ `0.1.0`) |
| `subjects` | Speakers/objects with named anchors |
| `exclusionZones` | Hard/soft no-cover regions |
| `items` | Balloons and intentional `silent` markers |

Required top-level keys; `additionalProperties` is false. Ids match `^[A-Za-z0-9][A-Za-z0-9._-]*$`.

Minimal skeleton:

```json
{
  "schemaVersion": "0.1.0",
  "pageId": "P022",
  "coordinateSpace": {
    "width": 1800,
    "height": 2700,
    "origin": "top-left",
    "units": "art-px"
  },
  "renderProfile": { "id": "rift-city-proof", "version": "0.1.0" },
  "subjects": [],
  "exclusionZones": [],
  "items": [
    {
      "kind": "balloon",
      "id": "P022-02-B01",
      "panelId": "P022-02",
      "speakerId": "lex",
      "shapeId": "speech",
      "placement": { "x": 930, "y": 1110, "width": 560, "height": 300 },
      "content": { "en": { "lines": ["We keep", "moving."] } }
    }
  ]
}
```

---

## 2. Coordinate space

```json
{
  "coordinateSpace": {
    "width": 1800,
    "height": 2700,
    "origin": "top-left",
    "units": "art-px"
  }
}
```

- **Origin:** top-left. **Units:** art pixels (integers ≥ 1 for width/height).
- Every bounds, point, anchor, exclusion, and SVG `viewBox` uses this space.
- Overlay `viewBox` is exactly `0 0 <width> <height>` so compositing needs no scale/offset.
- Balloon bodies that leave the page → `OUT_OF_BOUNDS` (error).

Bounds are `{ x, y, width, height }` with positive width/height. Points are `{ x, y }`.

---

## 3. Top-level fields

### `schemaVersion`

Constant `"0.1.0"`. Wrong value → `SCHEMA_INVALID`.

### `pageId`

Stable identifier for the page (appears in diagnostics).

### `renderProfile`

```json
{ "id": "rift-city-proof", "version": "0.1.0" }
```

Binds fill/stroke, padding, font, and fit limits from the compiled profile in `src/profile.ts`. The proof profile embeds **Noto Sans Regular** (Latin + Cyrillic) and digests the font bytes.

### `subjects` / `exclusionZones` / `items`

See sections below. `items` must have at least one entry (`balloon` or `silent`).

---

## 4. Subjects and anchors

```json
{
  "id": "lex",
  "bounds": { "x": 1090, "y": 1510, "width": 360, "height": 790 },
  "anchors": {
    "mouth": { "x": 1225, "y": 1685 }
  }
}
```

- Subject `bounds` describe the figure for editorial context; they are **not** automatic exclusion zones.
- `anchors` is a non-empty map of named points (`mouth`, `head`, `playback`, …). The renderer never invents anchors.
- A balloon `tail` must reference an existing `subjectId` + `anchor` name, or validation emits `UNKNOWN_ANCHOR`.

---

## 5. Exclusion zones

```json
{
  "id": "lex-face",
  "bounds": { "x": 1135, "y": 1570, "width": 190, "height": 215 },
  "severity": "hard"
}
```

| Severity | On balloon-body overlap |
| --- | --- |
| `hard` | Error `HARD_EXCLUSION_OVERLAP` — blocks render |
| `soft` | Warning `SOFT_EXCLUSION_OVERLAP` — still renders |

Use hard zones for faces, logos, critical art. Soft zones flag review without failing the build.

---

## 6. Lettering items

### `silent`

```json
{
  "kind": "silent",
  "id": "P022-04-S01",
  "panelId": "P022-04",
  "speakerId": "rec"
}
```

No geometry, text, or SVG. Marks an intentional absence so proofing can distinguish “left blank on purpose” from “forgot to letter.”

### `balloon`

Required: `kind`, `id`, `panelId`, `speakerId`, `shapeId`, `placement`, `content`.

Optional: `tail`, `localeOverrides`, `cornerRadius`, `edge`, `notchTop`, `fill`, `stroke`, `strokeWidth`, `lobes`.

#### Placement

Initial body box in art pixels. Layout may **expand** this box (uniformly within profile limits) so measured text + padding fit. Prefer a sensible seed size; do not micro-tune pixel outlines — the silhouette is owned by the shape builder.

#### Tail

```json
{
  "tail": {
    "subjectId": "lex",
    "anchor": "mouth",
    "attachment": "bottom",
    "bend": { "x": 1260, "y": 1490 }
  }
}
```

| Field | Notes |
| --- | --- |
| `subjectId` / `anchor` | Must resolve on a subject |
| `attachment` | `top` \| `right` \| `bottom` \| `left` \| `auto` |
| `bend` | Optional control point for the open tail |

Geometry is a **single closed path** with an **open tail join** (no crossbar cutting the tip). `auto` picks the side from tip vs body center.

#### Content (`text` vs `lines`)

Per locale (BCP 47-ish tags: `en`, `ru`, …), supply **exactly one** of:

- `text` — free string; wubble wraps at measured width
- `lines` — authored breaks; preserved (no re-wrap), still measured

Optional `sourceLabel` for editorial notes (e.g. found-recording labels).

```json
"content": {
  "en": { "lines": ["We keep", "moving."] },
  "ru": { "text": "Продолжаем двигаться." }
}
```

Missing locale for the requested render → `LOCALE_MISSING`. Missing glyphs in the bundled font → `GLYPH_MISSING`.

#### `localeOverrides`

Per-locale placement and/or tail bend without changing other languages:

```json
"localeOverrides": {
  "ru": {
    "placement": { "x": 855, "y": 1080, "width": 650, "height": 330 },
    "tailBend": { "x": 1245, "y": 1490 }
  }
}
```

English geometry is never reused as a fixed Russian container. If no override exists, fitting starts from the shared `placement` and fails with `TEXT_OVERFLOW` when unsafe.

---

## 7. Styling knobs

These apply to the **rounded-rect family** (public shape id `speech`). Ref-sheet shapes ignore `cornerRadius` / `edge` / `notchTop` for the silhouette (they map a fixed template path). Appearance overrides on ref shapes are ignored by the silhouette builder (ref fills still come from the profile).

### `cornerRadius` — `0..1`

Corner roundness as a fraction of `min(body.w, body.h) / 2`:

| Value | Look |
| --- | --- |
| `0` | Sharp rectangle |
| `~0.45` | Soft rounded rect |
| `1` | Full pill / stadium |

Default when omitted: `speech` → `1`. Ref shapes → n/a (template).

### `edge` — `smooth` \| `jagged`

| Value | Outline |
| --- | --- |
| `smooth` | Clean comic curves (default for speech) |
| `jagged` | Angular / jagged outline |

Jagged also clamps corner radius so edges stay edgy even if radius is mid-range.

### `notchTop` — boolean

When `true`, punches a lightning notch into the **top** edge of a single-body `speech` balloon. Default `false`. Meaningful for `speech` only; ref shapes ignore it (no error). Multi-lobe speech chains also ignore the notch (path builder is single-body only).

### `fill` / `stroke` / `strokeWidth`

Optional appearance overrides on the balloon item. When omitted, use `PROFILE.shapes.speech` defaults (cream fill `#fffaf0`, stroke `#241f1a`, width `10`). Former mint / pinkish looks are authored via these overrides (see recipes below).

### `lobes` — chained multi-bubble

Additional `{ placement, content }` lobes fused with the primary body into **one** open silhouette (open necks, no crossbars, one tail). Schema allows 1–8 lobes.

```json
"lobes": [
  {
    "placement": { "x": 200, "y": 320, "width": 480, "height": 160 },
    "content": { "en": { "lines": ["Then the middle", "thought lands."] } }
  }
]
```

Each lobe needs locale content for the requested language. Reading order is typically top → bottom. Tail attaches to the lobe closest to the tip.

For **chain**, lobe lettering can sit in template content bands on the fitted frame; for rounded-rect shapes, lobes expand as separate fitted bodies then fuse.

---

> **History:** early drafts used character/theme shape ids (`human-01`, `glitch-01`, `glitch-breaking-01`, then short `glitch` / `shatter`). Those shapeIds were **removed** in favor of one public rounded-rect shape `speech` plus authoring knobs (`cornerRadius`, `edge`, `notchTop`, optional `fill` / `stroke` / `strokeWidth`). Old ids are not accepted.

## 8. Shape catalog

Registered `shapeId` values (schema enum). All are implemented in profile `rift-city-proof` @ `0.1.0`.

### Rounded-rect family (one public shape)

| `shapeId` | Defaults | Notes |
| --- | --- | --- |
| `speech` | `cornerRadius` `1`, `edge` `smooth`, `notchTop` `false`, cream fill | Soft comic speech; all looks via knobs |

`speech` calls the shared rounded-rect builder (`cornerRadius`, `edge`, `notchTop`, `lobes`, open tail, optional appearance overrides).

#### Look recipes (authoring knobs, not separate shapeIds)

| Look | Knobs |
| --- | --- |
| Soft pill | `speech` (defaults) |
| Sharp box | `speech` + `cornerRadius: 0` |
| Jagged / angular | `speech` + `cornerRadius: 0` + `edge: "jagged"` (+ optional mint `fill` `#e7f2e9` / `stroke` `#142018`) |
| Notched / interrupted | same as jagged + `notchTop: true` (+ optional pinkish `fill` `#f3e6e6` / `stroke` `#2a1414`) |

Fixtures: `fixtures/speech-jagged.json`, `fixtures/speech-notch.json`. Gallery: `scripts/gen-speech-styles.mjs` → Soft / Square / Jagged.

### Ref-sheet family (hand-traced templates)

Silhouettes from Lex hand-sheet fill masks, mapped uniformly into the fitted frame. Use these ids directly as `shapeId`.

| `shapeId` | Character |
| --- | --- |
| `chain` | Two-lobe chained speech |
| `cloud` | Soft cloud / scalloped |
| `needle` | Tall needle with long tip |
| `round` | Round speech |
| `hook` | Hook tail baked in |
| `lightning` | Angular lightning body |
| `fluffy` | Fluffy / scalloped |
| `thought` | Thought bubble + dots |
| `rect` | Rectangular with taper |

Ref shapes use **content bands** (fractions of the mapped frame) so lettering sits in the body, not the baked tail or thought dots. `chain` also defines a second lobe band for per-lobe lines.

Unknown / unimplemented shape → `UNKNOWN_SHAPE` (error). With the current profile every catalog id is implemented; the code still gates on `implemented`.

---

## 9. Text-driven sizing

Pipeline (simplified):

1. **Measure** text with the exact bundled font (`opentype.js`).
2. Prefer keeping type large; **expand** the body (uniform factor) so text + padding fit.
3. Only then **shrink** font size toward the profile minimum.
4. Map the registered silhouette into the fitted body (rounded-rect builder or ref template).

Authored `lines` are never re-wrapped, but each line must still fit the usable width.

Profile knobs (per shape) include padding (absolute and/or ratio of min dimension), `usableWidthFactor`, `minFontSize` / `maxFontSize`, `maxLines`, `maxExpandFactor`. Ref shapes allow larger expand (text drives size); speech uses smaller expand steps then type shrink.

Failure after exhausting expand + min size → `TEXT_OVERFLOW`, often with a suggested wider `localeOverrides.*.placement.width`.

---

## 10. Diagnostics

Structured report:

```json
{
  "valid": false,
  "pageId": "P022",
  "locale": "ru",
  "diagnostics": [
    {
      "code": "TEXT_OVERFLOW",
      "level": "error",
      "itemId": "P022-02-B01",
      "message": "…",
      "suggestions": [{ "field": "localeOverrides.*.placement.width", "minimum": 620 }]
    }
  ]
}
```

| Code | Level | Meaning |
| --- | --- | --- |
| `SCHEMA_INVALID` | error | Manifest fails JSON Schema |
| `LOCALE_MISSING` | error | No content for requested locale (item or lobe) |
| `GLYPH_MISSING` | error | Font cannot render a required character |
| `TEXT_OVERFLOW` | error | Cannot fit within type / line / expand limits |
| `OUT_OF_BOUNDS` | error | Body (or lobe) leaves the coordinate space |
| `HARD_EXCLUSION_OVERLAP` | error | Body covers a hard exclusion |
| `UNKNOWN_SHAPE` | error | Shape not implemented in profile |
| `UNKNOWN_ANCHOR` | error | Tail subject/anchor missing |
| `BALLOON_OVERLAP` | warning | Two balloon bodies overlap |
| `SOFT_EXCLUSION_OVERLAP` | warning | Body covers a soft exclusion |
| `TAIL_CROSSES_BODY` | warning | Tail crosses another balloon |
| `READING_ORDER_AMBIGUOUS` | warning | Geometry conflicts with item order |

`valid` is false if any **error** is present. `render` / `proof` refuse to write output on errors. Warnings do not block. Suggestions are advisory — the renderer never auto-applies them.

---

## 11. CLI and library

Requires [Bun](https://bun.sh) ≥ 1.3.

```sh
bun install

# Validate (optional locale defaults to en)
bun run wubble -- validate examples/page-022.json
bun run wubble -- validate examples/page-022.json --locale ru --diagnostics report.json

# Render language overlays
bun run wubble -- render examples/page-022.json --locale en --output page-022.en.svg
bun run wubble -- render examples/page-022.json --locale ru --output page-022.ru.svg

# Proof composite over art
bun run wubble -- proof examples/page-022.json --locale en --art page-022.png --output page-022.en.proof.png
```

Or via the package bin:

```sh
bunx wubble validate examples/page-022.json
```

Exit codes: `0` ok · `1` validation failed · `2` usage/IO · `3` internal.

Typecheck and tests:

```sh
bunx tsc --noEmit
# or: bun run typecheck
bun test
```

### Library

```ts
import { validatePage, renderPage } from "wubble";

const report = validatePage(manifest, {
  locale: "en",
  profileId: "rift-city-proof",
});

const { svg, diagnostics } = renderPage(manifest, {
  locale: "ru",
  profileId: "rift-city-proof",
});
```

Use extensionless imports. `renderPage` is pure relative to compiled profiles and font assets; file I/O and proof compositing stay in the CLI.

---

## 12. Worked examples

### Bilingual page-022 (`examples/page-022.json`)

- One `speech` balloon for Lex, bilingual `lines`, Russian `localeOverrides` for wider placement + `tailBend`.
- Hard exclusions on Lex face and the recording-device lens.
- A `silent` item for the recording character (intentional no balloon).

```sh
bun run wubble -- validate examples/page-022.json
bun run wubble -- render examples/page-022.json --locale en --output /tmp/p022.en.svg
bun run wubble -- render examples/page-022.json --locale ru --output /tmp/p022.ru.svg
```

### Chain-2 with per-lobe lines (`fixtures/chain-three.json`)

`speech` + `lobes` (two extra beats). Primary `content` is the top lobe; each lobe has its own `lines`. One bottom tail to `mouth`.

For the ref-sheet chain silhouette use `shapeId: "chain"` and put secondary dialogue in `lobes` so lettering lands in the template’s lobe content band.

### Ref shape

```json
{
  "kind": "balloon",
  "id": "REF-CLOUD",
  "panelId": "P1",
  "speakerId": "lex",
  "shapeId": "cloud",
  "placement": { "x": 200, "y": 180, "width": 520, "height": 360 },
  "content": { "en": { "lines": ["Soft cloud", "lettering."] } }
}
```

Text expands the frame; the cloud silhouette maps into it. Do not set `cornerRadius` / `edge` expecting to reshape a ref path.

### Corner / edge variants (`fixtures/corners-grid.json`)

Same `speech` family, four variants:

| Item | Knobs | Look |
| --- | --- | --- |
| radius 0 | `cornerRadius: 0`, `smooth` | Sharp rect |
| mid | `0.45`, `smooth` | Soft rounded |
| radius 1 | `1`, `smooth` | Pill |
| jagged | `0`, `jagged` | Angular square |

Gallery strip: `demo-out/gallery/speech-styles-*.png` (Soft · Square · Jagged) via `scripts/gen-speech-styles.mjs`.

---

## 13. What an LLM may / may not author

### May

- Choose registered `shapeId` values from the catalog
- Propose `placement` / lobe placements and `tail` (subject, anchor, attachment, bend)
- Set `cornerRadius`, `edge`, `notchTop`, optional `fill` / `stroke` / `strokeWidth`, and `lobes` where the shape family supports them
- Supply localized `text` or `lines` and `localeOverrides`
- Revise only permitted fields in response to diagnostics / suggestions
- Add or adjust soft/hard exclusion proposals for human review

### Must not

- Emit raw SVG, path `d` strings, or arbitrary filters/transforms
- Invent shape IDs outside the schema enum (use catalog names only, e.g. `cloud`, `speech`)
- Change fonts, digests, or profile padding (appearance may use optional per-balloon `fill` / `stroke` / `strokeWidth` only)
- Disable hard validation gates or invent diagnostic codes
- Reuse English fitted bounds as a fixed Russian container
- Rewrite renderer code or “fix” overflow by pasting geometry

Dialogue and translation remain human-owned (or a separate translation pipeline). Wubble only letters what the manifest already says.

---

## Quick reference links

| Artifact | Path |
| --- | --- |
| Schema | [`schemas/page.schema.json`](schemas/page.schema.json) |
| Types | [`src/types.ts`](src/types.ts) |
| Profile | [`src/profile.ts`](src/profile.ts) |
| Shapes | [`src/shapes/`](src/shapes/) |
| Example | [`examples/page-022.json`](examples/page-022.json) |
| Fixtures | [`fixtures/`](fixtures/) |
| Product SPEC | [`SPEC.md`](SPEC.md) |
