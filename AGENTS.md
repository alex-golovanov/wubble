# Agent rules — wubble

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
