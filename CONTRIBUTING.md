# Contributing to BRACE

Thank you for helping make private, inspectable AI memory better. Contributions are welcome through focused issues and pull requests.

## Ground rules

- Never commit a real BRACE database, backup, export, project corpus, API key, machine path, or screenshot containing personal data.
- Use the synthetic Northstar workspace for examples, tests, documentation, and captures.
- Preserve the local-first boundary. New network behavior must be optional, explicit, documented, and off by default.
- Preserve provenance. A retrieval result must not imply that generated or durable memory is source evidence.
- Do not add arbitrary script execution to BRACE Skills.
- Keep MCP read-only by default. New mutation capabilities need narrow schemas, explicit authorization, and tests.

## Development setup

```bash
git clone https://github.com/GYASH28/B.R.A.C.E-brain.git
cd B.R.A.C.E-brain
npm ci
npm test
npm run typecheck
npm run lint
```

Run the desktop in development:

```bash
npm run electron:dev
```

Run the full synthetic desktop journey:

```bash
npm run electron:e2e
npm run electron:mcp-smoke
```

## Pull requests

Keep each pull request centered on one change. Include:

1. The user problem and boundary affected.
2. Tests for behavior and failure cases.
3. Privacy and security impact, even when the answer is “none.”
4. Screenshots for visible changes, made only with synthetic data.
5. Documentation changes when configuration, data movement, permissions, or limitations change.

Before requesting review, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run electron:compile
```

Linux contributors with a desktop session should also run `npm run electron:e2e`. Website changes must pass the site accessibility audit described in [`website/builds/brace/BRIEF.md`](website/builds/brace/BRIEF.md).

## Commit style

Use short imperative subjects such as `Add project reindex cancellation`. Explain the motivation and relevant tradeoffs in the body when the change is not obvious.

## Reporting security problems

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) and do not attach a real database or export.

## License

By contributing, you agree that your contribution is licensed under the Apache License 2.0.
