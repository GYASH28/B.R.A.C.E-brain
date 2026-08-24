---
title: Architecture Decisions
type: decision-log
status: evergreen
created: 2026-08-02
updated: 2026-08-18
tags: [architecture, privacy, decisions]
source: synthetic-demo
related: ["[[Northstar Workspace]]", "[[Research Notes]]"]
---

# Architecture Decisions

## ADR-001: Local data boundary

Decision: store structured memory in an external SQLite database. Imported files
remain canonical in their original project folders.

Rationale: application updates cannot overwrite memory, backups have one clear
target, and public source code never needs a user's data.

## ADR-002: Retrieval labeling

Decision: label search as semantic or hybrid only when an embedding provider
actually returned vectors. Full-text fallback is shown as lexical search.

Rationale: a trustworthy memory layer must explain how each result was found.
