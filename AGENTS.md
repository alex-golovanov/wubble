# Agent rules — wubble

## Wubble is a generic package

Wubble is published for anyone to use. It letters comics; it does not know
about any particular comic.

- **No project vocabulary in this repo.** Balloons have a lettering _style_ —
  `dialogue`, `notice`, `caption` — named for their form, never for who is
  speaking. Do not add a register named after a character, a species, a device
  or a story concept, however natural it feels while working on one project. A
  project that has robots maps its robots onto `notice`; a project with no
  robots still needs a squared, strict, formal box.
- **No project house rules in this repo either.** Whether a register must carry
  a label, may take a tail, draws brackets, or which typeface it speaks in, is
  a project's decision. Wubble ships neutral defaults in `PROFILE.styles` and
  accepts overrides per render (`RenderOptions.styles` / `.fonts`, or
  `--config <file.json>` on the CLI). Rules that belong to one comic go in that
  comic's config file, never into `src/`.
- The same goes for names in the emitted SVG (`data-style`, `data-part`) and in
  the manifest schema.

If a change would make wubble read as though it were written for one comic,
it is the wrong change.

## TypeScript strictness

- Keep `tsconfig.json` maximally strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports`). Do not weaken flags without an explicit human decision.
- `bun run check` must pass (typecheck + lint + assertion scan + fmt:check).
- No `.ts` / `.js` extensions in import paths.

## Forbidden

- Type assertions: `value as T`, `<T>value`.
- `as const` (use `satisfies SomeType` / explicit annotations instead).
- Non-null assertions: `value!` (narrow with `if`, early `return`/`throw`, or `at()` from `src/util.ts`).

## Required patterns

- Validate object/array literals with `satisfies ExplicitType` (define types in `types.ts` or nearby).
- Prefer type guards (`value is T`) and proper generics over casting.
- For optional fields under `exactOptionalPropertyTypes`, omit the key when the value is `undefined` (see `fitStyleOf` in `src/layout.ts`).
- Prefer pure `satisfies` + explicit types for literal preservation. Only if `satisfies` cannot preserve needed literals, use `exact<const T>(value: T): T` — never `as const`.

## Lint / CI

- Oxlint: `typescript/consistent-type-assertions` with `assertionStyle: "never"`, plus `typescript/no-non-null-assertion`.
- Oxlint does not specially ban bare `as const` beyond assertions-never; `scripts/check-no-assertions.mjs` rg-fails on `\bas const\b` and type assertions in `src/**/*.ts` and `tests/**/*.ts`.
