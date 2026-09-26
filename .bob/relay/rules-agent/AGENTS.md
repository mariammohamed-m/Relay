# Agent Mode - Project-Specific Coding Rules

> These supplement `implement.md` and apply to every Agent-mode session in this workspace.

- **All CLI file writes must use `atomicWrite` or `writeJSON`** from `cli/src/fsutil.ts`. Direct `writeFile` calls on task.json will corrupt it on a mid-write crash.
- **All local imports in `cli/` require `.js` extensions** (NodeNext module resolution), even though the source files are `.ts`. Example: `import { foo } from './fsutil.js'`.
- **`dashboard/src/lib/types.ts` is a pure re-export** - `export * from '../../../cli/src/types'`. Never add types there; all shapes live in `cli/src/types.ts`.
- **Never add new fields to `Task`, `StageRecord`, `AcceptanceCriterion`, etc.** without updating `SCHEMA_VERSION` in `cli/src/types.ts` and checking the dashboard reader.
- **`paths.ts` path helpers are functions, not constants** - never cache them at module load time or tests will break (each test `chdir`s to a scratch dir).
- **Tests use `node:test`** (not vitest/jest). Run with `npm run test` from `cli/`. There is no single-test filter - temporarily comment out unwanted tests to isolate one.
- **`AcceptanceCriterion.covered` must stay `false`** at brief time; only the `test` stage (via `npx relay criteria cover`) may set it to `true` when a real test exists.
- **New gotcha entries** in `.relay/knowledge/gotchas.md` must follow the exact format documented in `.bob/skills/relay-harvest/SKILL.md`; off-format entries silently disappear from the compiled snapshot.
