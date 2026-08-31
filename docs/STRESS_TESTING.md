# Long-running profile stress testing

BRACE ships a deterministic stress gate for the failure modes that matter after months of use: a growing local corpus, repeated recall, record churn, multiple SQLite connections, restart persistence, backup recovery, malformed input, and bounded renderer payloads.

Run the release-sized gate:

```bash
npm run test:stress
```

Use a larger local corpus without changing the committed test:

```bash
BRACE_STRESS_RECORDS=10000 BRACE_STRESS_SEARCHES=1000 npm run test:stress
```

The harness always creates an isolated operating-system temporary directory and removes it on completion. It never reads a real BRACE profile, imported project, credential, or workspace.

## Release thresholds

The default 5,000-record gate fails when any of these contracts regress:

- Corpus creation exceeds 120 seconds.
- Lexical recall exceeds 200 ms at p95 or 400 ms at p99 across 500 searches.
- A bounded 500-record list plus graph projection exceeds 2 seconds.
- A privacy-safe full export exceeds 10 seconds.
- Reopening the local database exceeds 3 seconds.
- Resident memory growth exceeds 256 MB.
- SQLite `quick_check`, backup/restore parity, pin persistence, secret redaction, or two-connection WAL behavior fails.

These are release ceilings, not marketing latency claims. The script prints its measured JSON report to standard output so CI retains evidence without committing logs or runtime databases.

## Why these scenarios

The design follows established upstream testing practices:

- [k6 thresholds](https://github.com/grafana/k6-learn/blob/main/Modules/II-k6-Foundations/07-Setting-test-criteria-with-thresholds.md) turn performance expectations into failing release criteria instead of passive charts.
- [Playwright](https://github.com/microsoft/playwright) demonstrates isolated, reproducible browser contexts and web-first assertions.
- [SQLite's fuzzcheck harness](https://github.com/sqlite/sqlite/blob/master/test/fuzzcheck.c) motivates malformed-input and integrity checks that look for crashes, assertions, and damaged state.
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices) recommends public-behavior tests, realistic rendering, isolated databases, and chaos/recovery coverage.

The Electron E2E, MCP executable smoke test, website interaction audits, package audit, privacy scan, and native installer smoke tests remain separate gates because a storage benchmark cannot prove those surfaces.
