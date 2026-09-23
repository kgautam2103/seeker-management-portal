# Seeker Management Portal

> **"No seeker is ever lost."**

A Progressive Web App for the Sahaja Yoga volunteer community: capture every seeker once, record attendance, and run timely follow-up across email, SMS, and WhatsApp — for volunteer coordinators, instructors, and regional coordinators. Rolling out DMV → New York and Texas → all US.

## Documents

- [Product Requirements (PRD)](docs/PRD.md) — **v0.3, canonical**: vision, problem, goals and metrics, personas, requirements R1–R15, rollout, NFRs, decisions D1–D11, open questions, document history
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — three phases: Capture (DMV) → Communicate (+NY, TX) → Anticipate (all US)
- [Data Model](docs/DATA_MODEL.md) — **v1.1**: entities, ERDs, constraints, row-level security, derived data; DDL in [db/schema.sql](db/schema.sql), behavioral tests in [db/smoke_test.sql](db/smoke_test.sql)
- [Architecture](docs/ARCHITECTURE.md) — **proposed v0.2**: decisions AD-1…AD-12, components, key flows, security, environments, cost today and one year out, phase mapping
- [Import Template](docs/IMPORT_TEMPLATE.md) — 19 columns and rules for the ~30k-row historical seeker upload (R2); CSV in [docs/assets](docs/assets/seeker-import-template.csv)
- [Archive](docs/archive/PRD-v0.1-2026-09-02.md) — the original v0.1 PRD from the retired Google Doc, verbatim

## Status

PRD v0.3 with all open questions answered; data model v1.1 validated against PostgreSQL 16 (smoke test 5/5); architecture v0.2 awaiting approval of its seven decisions before the Phase 1 scaffold begins. Nothing is built or deployed yet.

## Structure

```
seeker-management-portal/
├── README.md
├── db/
│   ├── schema.sql                       # first-pass PostgreSQL DDL + RLS (27 tables, 20 policies)
│   └── smoke_test.sql                   # trigger and RLS tests, run as a non-superuser
└── docs/
    ├── PRD.md
    ├── IMPLEMENTATION_PLAN.md
    ├── DATA_MODEL.md
    ├── ARCHITECTURE.md
    ├── IMPORT_TEMPLATE.md
    ├── archive/
    │   └── PRD-v0.1-2026-09-02.md       # original Google Doc PRD, verbatim
    └── assets/
        ├── planning-notes-2026-09.jpg   # original handwritten requirements
        └── seeker-import-template.csv   # header + synthetic example rows
```

## Working rules

- This is a **public** repository: no real seeker data is ever committed. Samples and fixtures are synthetic.
- `docs/` is the single source of truth; there is no external copy of the PRD to keep in sync.
