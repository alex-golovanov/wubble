# Wubble (formerly Clip Balloon) — Initial Package Specification

**Status:** Initial proof specification  
**Format version:** `0.1.0`  
**Package status:** Implemented as `wubble` 0.1.0 (Milestone A+B; see living-docs note for later extensions)  
**Primary use:** Generate independently renderable English and Russian comic-lettering overlays from one placement manifest and one text-free art master.

> **Living format docs:** Implementation has extended beyond this initial proof contract.
> Registered shapes now include `speech` and
> `chain`, `cloud`, `needle`, `round`, `hook`, `lightning`, `fluffy`, `thought`, `rect`;
> balloons accept `cornerRadius`, `edge`, `notchTop`, optional appearance overrides, and `lobes`; layout is text-driven
> (measure → expand body with padding → map silhouette). Former `glitch` / `shatter` shapeIds were removed in favor of `speech` knobs. Treat
> [`FORMAT.md`](FORMAT.md) and [`schemas/page.schema.json`](schemas/page.schema.json)
> as the living format documentation. This SPEC remains the historical product /
> determinism contract — do not treat “Later registered components” below as unimplemented.

## 1. Product definition

Clip Balloon is a small deterministic lettering engine for comics produced from generated or traditionally drawn art.

The art system supplies:

- one text-free page or panel image;
- its exact width and height;
- exact subject bounds and named attachment anchors;
- optional regions that lettering must not cover;
- stable dialogue IDs;
- localised text;
- a constrained request for an approved balloon shape and placement.

Clip Balloon returns one transparent overlay per requested language. The English and Russian overlays share narrative identity and speaker attachment but may use different line breaks, balloon dimensions and placement overrides.

An LLM may propose or revise the manifest. It does not write SVG, invent paths, choose arbitrary styling or alter renderer code.

## 2. Goals

The initial package must:

1. produce separate `en` and `ru` overlays from one manifest;
2. use the same coordinate space as the source art;
3. keep stable item IDs across languages and revisions;
4. render only approved, named balloon components;
5. measure real bundled font files before wrapping text;
6. allow language-specific text, line breaks and placement overrides;
7. attach tails to explicit subject anchors;
8. detect overlaps, missing translations and unreadable fitting;
9. return structured diagnostics that a human or LLM can act on;
10. produce identical SVG bytes when the normalized inputs, renderer version and font bytes are identical.

The last requirement is the measurable engineering definition of predictable repeat runs. It does not imply that two different manifests, locales, fonts or renderer versions must have the same output.

## 3. Non-goals for the proof

The proof does not include:

- a general-purpose vector drawing engine;
- procedural invention of balloon styles;
- a graphical page editor;
- dialogue writing or translation;
- automatic character detection;
- arbitrary user-supplied SVG paths;
- captions, sound effects or free-standing display lettering;
- page imposition, print bleed management or PDF production;
- automatic optimal placement across an entire page;
- direct calls to an LLM or image generator.

These exclusions keep the renderer small enough to prove its central contract.

## 4. Responsibility boundary

### Humans own

- dialogue and translations;
- approval of balloon shapes and typography;
- final editorial judgment;
- approval of any placement that passes mechanical checks but harms storytelling.

### The LLM may own

- choosing from registered shape IDs;
- proposing balloon bounds;
- selecting a named subject anchor;
- proposing tail bend and attachment side;
- setting a maximum width;
- adding locale-specific placement overrides;
- revising only those fields in response to diagnostics.

### The renderer owns

- schema validation and normalization;
- font loading, shaping and measurement;
- line wrapping and vertical layout;
- balloon sizing within declared limits;
- approved component geometry;
- tail construction and seam hiding;
- collision and legibility checks;
- SVG structure, numeric formatting and serialization;
- output diagnostics.

### The LLM may not control

- raw SVG or path data;
- font files, fallback fonts or glyph substitution;
- stroke colour, stroke width, fill colour or padding;
- arbitrary transforms or filters;
- serialization order or numeric precision;
- new shape IDs;
- disabling hard validation gates.

## 5. Coordinate model

Every manifest declares one page coordinate space:

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

All bounds, points, anchors, exclusions and outputs use this space. The SVG `viewBox` is exactly `0 0 <width> <height>`. A language overlay can therefore be composited over the art without repositioning or scaling.

Coordinates are finite numbers. Bounds require positive width and height. Points and bounds must remain inside the coordinate space unless a future format version explicitly permits bleed.

## 6. Manifest model

The normative schema is [`schemas/page.schema.json`](schemas/page.schema.json). A manifest contains:

- `schemaVersion` — exact data-contract version;
- `pageId` — stable page identifier;
- `coordinateSpace` — art dimensions and origin;
- `subjects` — known people or objects with bounds and named anchors;
- `exclusionZones` — important regions lettering should not cover;
- `items` — balloons or explicit silent instructions;
- `renderProfile` — registered shape and typography configuration.

### 6.1 Subjects

A subject has a stable ID, a bounding rectangle and named anchor points. Example anchors include `mouth`, `head`, `speaker` and `playback`. The renderer does not infer anchors from bounds.

```json
{
  "id": "lex",
  "bounds": { "x": 1110, "y": 1540, "width": 330, "height": 760 },
  "anchors": {
    "mouth": { "x": 1230, "y": 1695 }
  }
}
```

### 6.2 Exclusion zones

An exclusion zone has an ID, rectangular bounds and severity:

- `hard` — any balloon-body overlap is an error;
- `soft` — overlap is a warning for human review.

Subject bounds are not automatically exclusion zones. This lets a project protect faces and hands without preventing every intentional overlap with a figure silhouette.

### 6.3 Lettering items

Each item is one of two kinds:

- `balloon` — produces visible geometry and text;
- `silent` — produces no visible SVG node but remains present for editorial validation.

A balloon specifies:

- stable `id` and `panelId`;
- `speakerId`;
- registered `shapeId`;
- initial `placement` bounds;
- optional `tail` with a subject anchor and optional bend point;
- localised `content` keyed by BCP 47 language tag;
- optional `localeOverrides` for bounds and tail bend.

Visible line breaks may be authored with `lines`. Otherwise the renderer computes wrapping from `text`. A locale entry must supply exactly one of them.

`silent` items contain no placement, tail, shape or visible content. Their presence lets proofing assert that an intentional absence was not an accidental omission.

## 7. Registered visual components

The renderer accepts only versioned component IDs compiled into its render profile.

### `speech`

Initial human speech-balloon candidate (now the rounded-rect family default):

- soft pill body by default (`cornerRadius` 1, `edge` smooth);
- warm paper fill and dark outline from the render profile;
- one tapered tail with an **open join** (single closed silhouette, no crossbar);
- optional `cornerRadius` / `edge` / `notchTop` / appearance overrides / `lobes`;
- no random wobble;
- proportions derived deterministically from fitted bounds.

The candidate source is [`references/speech.svg`](references/speech.svg). It is a visual reference for component extraction, not a license for embedding arbitrary SVG from manifests.

### Later registered components (now implemented)

- Rounded-rect looks formerly split as `glitch` / `shatter` shapeIds are now **`speech` knobs** (`cornerRadius`, `edge`, `notchTop`, optional `fill` / `stroke` / `strokeWidth`);
- `chain`, `cloud`, `needle`, `round`, `hook`, `lightning`, `fluffy`, `thought`, `rect` — hand-sheet silhouettes;
- `silent` — manifest-only instruction, never visible.

Geometry for these ids is implemented in the current package. Optional knobs apply to the rounded-rect family (`speech`); ref shapes map fixed templates (see [`FORMAT.md`](FORMAT.md)).

## 8. Text and typography

The render profile must bind each typography role to an exact font asset and record a digest of that asset. Production cannot depend on an operating-system font lookup.

The proof needs one body typeface with real Latin and Cyrillic glyphs. A font choice is acceptable only when it passes a print-size specimen; no family is selected by this specification.

For each locale, the renderer must:

1. shape and measure Unicode text using the configured font asset;
2. preserve authored lines when `lines` is present;
3. otherwise wrap only at valid language break opportunities;
4. use registered padding and line-height values;
5. expand the balloon inside its declared limits before reducing type size;
6. reject content that cannot fit above the minimum type size or within the maximum line count;
7. reject missing glyphs and fallback substitution.

English geometry must never be reused as a fixed container for Russian text. Russian may use `localeOverrides.placement`; if no override exists, the renderer fits the Russian content starting from the shared placement and reports failure when it cannot do so safely.

## 9. Geometry pipeline

For each visible item and requested locale, processing order is fixed:

1. validate the manifest;
2. select locale content and apply locale overrides;
3. resolve the render profile and shape ID;
4. shape and measure text;
5. determine line breaks;
6. resolve body bounds within component limits;
7. construct the body from the registered component function;
8. resolve the named target anchor;
9. construct the tail behind the body;
10. validate page bounds, collisions, type size and tail ownership;
11. serialize the overlay and diagnostics.

The tail function receives body bounds, target point, attachment side and optional bend point. It returns registered geometry only. The target tip must terminate at the named anchor or within the render profile’s fixed tolerance.

## 10. Validation and diagnostics

Validation returns a non-zero exit code for errors and a structured JSON report for both errors and warnings.

Required diagnostic codes:

| Code                      | Level   | Meaning                                                       |
| ------------------------- | ------- | ------------------------------------------------------------- |
| `SCHEMA_INVALID`          | error   | Manifest does not match the declared schema.                  |
| `LOCALE_MISSING`          | error   | A requested locale has no content for an item.                |
| `GLYPH_MISSING`           | error   | The configured font cannot render a required character.       |
| `TEXT_OVERFLOW`           | error   | Text cannot fit within hard type and line limits.             |
| `OUT_OF_BOUNDS`           | error   | Visible geometry leaves the coordinate space.                 |
| `HARD_EXCLUSION_OVERLAP`  | error   | Balloon body covers a hard exclusion zone.                    |
| `UNKNOWN_SHAPE`           | error   | Manifest requests an unregistered component.                  |
| `UNKNOWN_ANCHOR`          | error   | Tail target cannot resolve to a named subject anchor.         |
| `BALLOON_OVERLAP`         | warning | Two balloon bodies overlap.                                   |
| `SOFT_EXCLUSION_OVERLAP`  | warning | Balloon body covers a soft exclusion zone.                    |
| `TAIL_CROSSES_BODY`       | warning | Tail crosses a different balloon or protected subject region. |
| `READING_ORDER_AMBIGUOUS` | warning | Geometric ordering conflicts with manifest item order.        |

Example report:

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
      "message": "Text requires 6 lines; maximum is 4.",
      "suggestions": [{ "field": "localeOverrides.ru.placement.width", "minimum": 620 }]
    }
  ]
}
```

Suggestions are advisory changes to permitted manifest fields. The renderer never silently applies them.

## 11. Output contract

### SVG overlay

The primary proof output is UTF-8 SVG with:

- page-sized `viewBox`;
- transparent background;
- one top-level group per visible item, identified by stable item ID;
- tail before body, and body before text, within each item group;
- no linked external assets except the package-controlled font strategy selected for the proof;
- no timestamps, random IDs, generator comments or machine-specific paths;
- fixed element ordering, attribute ordering, whitespace, number precision and newline style.

The SVG is an interchange and compositing artifact. Manifests remain the editable source.

### Proof image

The `proof` command composites an overlay over supplied art without changing either source. It exists for review only and is not an editable master.

### Locale isolation

Rendering `en` includes no Russian text nodes or hidden Russian metadata. Rendering `ru` includes no English fallback. A missing locale is an error.

## 12. Determinism contract

The deterministic input tuple is:

```text
renderer package version
+ schema version
+ normalized manifest bytes
+ requested locale
+ render profile version
+ exact font asset bytes
+ output options
```

Identical tuples must produce identical SVG bytes and identical diagnostic JSON bytes. Determinism requires:

- no random source;
- no timestamps;
- no environment-dependent fonts;
- no locale behavior inherited from the host operating system;
- fixed decimal rounding;
- canonical object and SVG element ordering;
- LF newlines and UTF-8 encoding;
- stable dependency versions in the implementation repository.

Changing any member of the tuple permits a different result.

## 13. CLI contract

```sh
wubble validate <manifest>
wubble render <manifest> --locale <tag> --output <overlay.svg>
wubble proof <manifest> --locale <tag> --art <image> --output <proof.png>
```

All commands support `--diagnostics <file.json>`. `render` refuses to write an SVG while any error-level diagnostic exists. Warnings do not block output.

Exit codes:

- `0` — valid and completed;
- `1` — manifest or rendering validation failed;
- `2` — command usage or inaccessible input;
- `3` — internal renderer failure.

## 14. Public library contract

The package exposes the same core without file-system side effects:

```ts
type Locale = string;

interface RenderOptions {
  locale: Locale;
  profileId: string;
}

interface RenderResult {
  svg: string | null;
  diagnostics: DiagnosticReport;
}

declare function validatePage(manifest: unknown, options: RenderOptions): DiagnosticReport;

declare function renderPage(manifest: unknown, options: RenderOptions): RenderResult;
```

`renderPage` is pure relative to the package’s compiled profiles and font assets. File reading, writing and image compositing stay in the CLI layer.

## 15. Proof acceptance criteria

The first implementation is complete when all of these pass:

1. the example manifest validates against the bundled schema;
2. `en` and `ru` render as separate page-sized transparent SVG overlays;
3. both overlays use the same stable item ID and target anchor;
4. the Russian balloon may use wider bounds without changing the English result;
5. both locales use measured glyphs from one exact bundled bilingual font asset;
6. missing Russian text fails with `LOCALE_MISSING` and emits no overlay;
7. an impossible fit fails with `TEXT_OVERFLOW` and names the item;
8. a hard face exclusion fails with `HARD_EXCLUSION_OVERLAP`;
9. two consecutive renders of the same deterministic input tuple are byte-identical;
10. a golden-image proof confirms that the body masks the tail seam;
11. the renderer contains no code path for manifest-supplied SVG or arbitrary style values;
12. the human balloon resembles the supplied `speech` reference closely enough for explicit visual review.

Passing these criteria proves the architecture, not the complete Rift City lettering language.

## 16. Implementation sequence

### Milestone A — Contract

- freeze schema `0.1.0` with fixtures for valid bilingual, missing locale, overflow and hard overlap;
- define canonical normalization and diagnostic serialization;
- bind one exact Latin/Cyrillic font asset after visual and licensing review.

### Milestone B — Human balloon proof

- implement text shaping, measurement and wrapping;
- implement `speech` body scaling and deterministic tail construction;
- render English and Russian SVG overlays;
- add golden and byte-determinism tests.

### Milestone C — Placement loop

- emit actionable diagnostics;
- define a compact LLM authoring prompt that lists permitted fields;
- test a revise-manifest-only loop against deliberate collision and overflow fixtures.

### Milestone D — Rift City channel grammar

- parametric `speech` knobs + ref-sheet shapes are implemented (see FORMAT.md);
- continue source labels and language-specific interruption behavior as editorial needs grow;
- validate the `silent` instruction as an intentional absence.

PDF export, editor UI and page-wide automatic placement require separate specifications after the proof.

## 17. Decisions intentionally left outside version 0.1.0

These are real later decisions, not hidden implementation assumptions:

- package and repository name;
- npm scope and publication policy;
- open-source license;
- selected body typeface and its redistribution terms;
- exact minimum print size and maximum line count;
- further channel grammar beyond parametric `speech` knobs and ref-sheet shapes;
- whether release SVG keeps text live or converts glyphs to paths;
- whether PDF export belongs in this package or a publishing adapter.

None blocks the schema and human-balloon proof except selection of a legally redistributable bilingual font for the implementation repository.
