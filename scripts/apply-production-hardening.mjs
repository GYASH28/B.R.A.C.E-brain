#!/usr/bin/env node

// Compatibility entry point. The maintained production hardening transform lives
// in patch-production-security.mjs; keeping one implementation prevents the
// security patch and its regression fixtures from drifting apart.
await import("./patch-production-security.mjs");
