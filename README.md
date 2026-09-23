# Seeker Management Portal

> **"No seeker is ever lost."**

A Progressive Web App for the Sahaja Yoga volunteer community: capture every seeker once, record attendance, and run timely follow-up across email and messaging — for volunteer coordinators, instructors, and regional coordinators.

## Documents

- [Product Requirements (PRD)](docs/PRD.md) — v0.2: vision, problem, personas, requirements R1–R15, NFRs, data model, decisions, open questions
  - Review copy: [Google Doc](https://docs.google.com/document/d/1N0fkrvUVUes5--Y7oF8G9fnje1pyLR_ThL0Ke8Bt16s/edit)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — three phases: Capture → Communicate → Anticipate
- [Data Model](docs/DATA_MODEL.md) — **v1.0 final**: entities, ERDs, constraints, RLS, derived data; DDL in [db/schema.sql](db/schema.sql), tests in [db/smoke_test.sql](db/smoke_test.sql)
- [Architecture](docs/ARCHITECTURE.md) — proposed v0.1: decisions AD-1…AD-12, components, key flows, security, environments, cost, phase mapping
- [Import Template](docs/IMPORT_TEMPLATE.md) — columns and rules for the historical seeker upload (R2); CSV in [docs/assets](docs/assets/seeker-import-template.csv)

## Status

Requirements drafted; data model final (v1.0); architecture proposed (v0.1, awaiting approval).

## Structure

```
seeker-management-portal/
├── README.md
└── docs/
    ├── PRD.md
    └── IMPLEMENTATION_PLAN.md
```
