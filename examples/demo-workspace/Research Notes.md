---
title: Research Notes
type: evidence-log
status: active
created: 2026-08-04
updated: 2026-08-21
tags: [research, evidence, usability]
source: synthetic-demo
related: ["[[Northstar Workspace]]", "[[Architecture Decisions]]"]
---

# Research Notes

## Retrieval study

Participants found source excerpts more trustworthy when the result showed a
stable project URI and the exact Markdown heading. #provenance

## Recovery drill

The synthetic profile was backed up, the process was restarted, and the local
database reopened with the same memory and decision counts. #recovery

## Open question

Should near-duplicate memories be merged automatically? The current design only
suggests pairs for review because superficially similar decisions can conflict.
