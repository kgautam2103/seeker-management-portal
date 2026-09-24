# Domain modules

One folder per domain (see ARCHITECTURE.md §4.1). Each module keeps the same shape:

- `schema.ts` — zod schemas shared by forms, server actions, and the importer
- `queries.ts` — reads through the RLS-scoped client
- `actions.ts` — server actions (writes)
- `events.ts` — Inngest events the module emits

Modules: `seekers`, `programs`, `attendance`, `comms`, `rules`, `import`, `reporting`. Only `seekers/schema.ts` exists in the scaffold; the rest land with their Phase 1 slices.
