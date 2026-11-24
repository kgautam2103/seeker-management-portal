# Domain modules

One folder per domain (see ARCHITECTURE.md §4.1). Each module keeps the same shape:

- `schema.ts` — zod schemas shared by forms, server actions, and the importer
- `queries.ts` — reads through the RLS-scoped client
- `actions.ts` — server actions (writes)
- `events.ts` — Inngest events the module emits

Modules: `seekers`, `programs`, `attendance`, `comms`, `rules`, `import`, `reporting`. `seekers` has `schema.ts`, `intake.ts` (normalization and result mapping for R1) and `queries.ts`; `attendance` has `schema.ts`, `roster.ts` (merges this device's unsent taps and notes into the roster) and `queries.ts` for R5. The other modules land with their Phase 1 slices. The offline outbox (seekers, attendance, remarks) and the cached rosters live in `src/offline/`.
