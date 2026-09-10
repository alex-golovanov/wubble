# wubble

Deterministic comic-lettering engine. Turns a page manifest into separate language-specific transparent SVG balloon overlays. A human or an LLM may author the manifest; **wubble** alone owns geometry, font measurement, validation, and SVG serialization. It never invents dialogue and never redraws the comic art.

Formerly specified as Clip Balloon / clip-balloon. The CLI binary is **`wubble`**.

## Start here

- [`FORMAT.md`](FORMAT.md) — **readable format handbook** (manifest, shapes, knobs, diagnostics, examples)
- [`schemas/page.schema.json`](schemas/page.schema.json) — manifest schema `0.1.0`
- [`SPEC.md`](SPEC.md) — historical product / rendering contract (see note at top)
- [`examples/page-022.json`](examples/page-022.json) — bilingual example
- [`references/speech.svg`](references/speech.svg) — human balloon visual reference

## Install

```sh
bun install
```

Requires [Bun](https://bun.sh) ≥ 1.3.

## Check / lint / format

Uses **TypeScript** (`tsc --noEmit`, maximally strict — see `tsconfig.json` / `AGENTS.md`), **oxlint** (type-aware via `oxlint-tsgolint`), **oxfmt**, and an assertion ban script.

```sh
bun run typecheck    # tsc --noEmit
bun run lint         # oxlint .  (bans `as` assertions + non-null `!`)
bun run lint:fix    # oxlint --fix .
bun run assertions   # fail on `as const` / `as T` / `!` in src+tests
bun run fmt          # oxfmt .
bun run fmt:check    # oxfmt --check .
bun run check        # typecheck + lint + assertions + fmt:check
```

TypeScript style for agents: **no** `as T`, **no** `as const`, **no** non-null `!` — use `satisfies`, type guards, and narrowing (`AGENTS.md`, `.cursor/rules/typescript-strict.mdc`).

`typescript/dot-notation` rejects `PROFILE.shapes["speech"]`-style string indexing — use `PROFILE.shapes.speech` or `shapeProfile(id)`.

## CLI

```sh
bun run wubble -- validate examples/page-022.json
bun run wubble -- render examples/page-022.json --locale en --output page-022.en.svg
bun run wubble -- render examples/page-022.json --locale ru --output page-022.ru.svg
bun run wubble -- proof examples/page-022.json --locale en --art page-022.png --output page-022.en.proof.png
```

Or via the bin after linking:

```sh
bunx wubble validate examples/page-022.json
```

All commands accept `--diagnostics <file.json>`.

Exit codes: `0` ok · `1` validation failed · `2` usage/IO · `3` internal.

`render` / `proof` refuse to write output when any error-level diagnostic is present.

## Library

```ts
import { validatePage, renderPage } from "wubble";

const report = validatePage(manifest, { locale: "en", profileId: "rift-city-proof" });
const { svg, diagnostics } = renderPage(manifest, { locale: "ru", profileId: "rift-city-proof" });
```

## Shapes (profile `rift-city-proof` @ `0.1.0`)

All registered ids are implemented:

| Family       | IDs                                                                                   |
| ------------ | ------------------------------------------------------------------------------------- |
| Rounded-rect | `speech`                                                                              |
| Ref sheet    | `chain`, `cloud`, `needle`, `round`, `hook`, `lightning`, `fluffy`, `thought`, `rect` |

`speech` is the single public rounded-rect shape (open-tail builder). Looks (soft / square / jagged / notched) are authoring knobs, not separate shapeIds. See [`FORMAT.md`](FORMAT.md) for recipes and content bands.

## Balloon styling knobs

Optional per-balloon fields (schema `0.1.0`):

- **`cornerRadius`** — `0..1` × `min(body.w, body.h) / 2`. `0` = sharp rectangle, `1` = full pill. Default for `speech`: `1`.
- **`edge`** — `smooth` \| `jagged`. Jagged + low radius → angular outline. Default for `speech`: `smooth`.
- **`notchTop`** — boolean; lightning notch on the top edge (`speech` only; ref shapes ignore). Default `false`.
- **`fill` / `stroke` / `strokeWidth`** — optional appearance overrides; default from `PROFILE.shapes.speech`.
- **`lobes`** — additional `{ placement, content }` lobes fused with the primary body into one chained silhouette (open necks, no crossbars; one tail).

Geometry is a single closed path with an **open tail join** (no crossbar cutting the tip). Ref-sheet shapes map fixed templates; they ignore radius/edge for the silhouette.

**Text-driven sizing:** measure text → expand body with padding → map silhouette (then shrink type only if expand limits are exhausted).

## Font strategy

Bundled **Noto Sans Regular** (OFL) at `assets/fonts/NotoSans-Regular.otf` (Latin + Cyrillic). Digested in the render profile. Text is measured with `opentype.js` from that exact file; the font is embedded as a base64 `@font-face` data URL in each SVG so overlays are self-contained and OS fonts are never consulted. Missing glyphs → `GLYPH_MISSING`.

## Status

Schema validation (Ajv draft 2020-12), full shape catalog above, bilingual overlays, locale overrides, tail→anchor, structured diagnostics, deterministic SVG bytes (fixed precision, LF, no timestamps/random). Beyond the original Milestone A+B proof: ref-sheet shapes, corner/edge knobs, lobes, and text-driven fit. Details in [`FORMAT.md`](FORMAT.md).

## Tests and typecheck

```sh
bun test
bunx tsc --noEmit
```

Or `bun run typecheck` (same as `tsc --noEmit`).
