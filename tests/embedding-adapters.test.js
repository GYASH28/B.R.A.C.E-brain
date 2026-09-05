"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const {
  createOllamaEmbeddingAdapter,
  createOpenAiCompatibleEmbeddingAdapter,
  normalizeEndpoint,
} = require("../core/embedding-adapters");

test("embedding endpoint policy requires loopback HTTP locally and HTTPS remotely", () => {
  assert.equal(normalizeEndpoint("http://127.0.0.1:11434", { loopbackOnly: true }), "http://127.0.0.1:11434");
  assert.throws(
    () => normalizeEndpoint("http://example.com", { loopbackOnly: true }),
    /loopback/,
  );
  assert.throws(
    () => normalizeEndpoint("http://example.com"),
    /HTTPS/,
  );
  assert.equal(normalizeEndpoint("https://embeddings.example.com/v1"), "https://embeddings.example.com");
});

test("Ollama adapter sends batches only to loopback and returns real provider vectors", async (context) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      requests.push({ url: request.url, body: JSON.parse(body) });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ embeddings: [[1, 0], [0, 1]] }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const adapter = createOllamaEmbeddingAdapter({
    endpoint: `http://127.0.0.1:${address.port}`,
    model: "synthetic-embed",
  });
  const vectors = await adapter.embed(["alpha", "beta"]);
  assert.deepEqual(vectors, [[1, 0], [0, 1]]);
  assert.equal(requests[0].url, "/api/embed");
  assert.deepEqual(requests[0].body, { model: "synthetic-embed", input: ["alpha", "beta"] });
});

test("OpenAI-compatible embeddings preserve provider ordering", async (context) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
    }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const adapter = createOpenAiCompatibleEmbeddingAdapter({
    endpoint: `http://127.0.0.1:${address.port}`,
    model: "synthetic-embed",
  });
  assert.deepEqual(await adapter.embed(["alpha", "beta"]), [[1, 0], [0, 1]]);
});

test("embedding transport blocks redirects and unsafe provider responses", async (context) => {
  let mode = "redirect";
  const server = http.createServer((request, response) => {
    if (mode === "redirect") {
      response.writeHead(302, { Location: `http://127.0.0.1:${server.address().port}/target` });
      response.end();
      return;
    }
    if (mode === "malformed") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{not-json");
      return;
    }
    if (mode === "huge") {
      response.writeHead(200, { "Content-Type": "application/json", "Content-Length": "5000" });
      response.end(JSON.stringify({ embeddings: [[1, 0]], padding: "x".repeat(4800) }));
      return;
    }
    if (mode === "nan") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ embeddings: [["not-a-number", 0]] }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const port = server.address().port;
  const adapter = (options = {}) => createOllamaEmbeddingAdapter({
    endpoint: `http://127.0.0.1:${port}`,
    model: "synthetic-embed",
    ...options,
  });
  await assert.rejects(adapter().embed(["alpha"]), /fetch failed|redirect/i);
  mode = "malformed";
  await assert.rejects(adapter().embed(["alpha"]), /malformed JSON/);
  mode = "huge";
  await assert.rejects(adapter({ maximumBytes: 1024 }).embed(["alpha"]), /safety limit/);
  mode = "nan";
  await assert.rejects(adapter().embed(["alpha"]), /finite numbers/);
});

test("embedding requests support cancellation, timeouts, and bounded retryable statuses", async (context) => {
  let retryRequests = 0;
  let mode = "retry";
  const server = http.createServer((request, response) => {
    if (mode === "retry") {
      retryRequests += 1;
      if (retryRequests === 1) return response.writeHead(429).end("synthetic secret must not surface");
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end(JSON.stringify({ embeddings: [[1, 0]] }));
    }
    if (mode === "slow") return;
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.closeAllConnections?.());
  context.after(() => server.close());
  const port = server.address().port;
  const retry = createOllamaEmbeddingAdapter({ endpoint: `http://127.0.0.1:${port}`, model: "synthetic", retries: 1 });
  assert.deepEqual(await retry.embed(["alpha"]), [[1, 0]]);
  assert.equal(retryRequests, 2);

  mode = "slow";
  const slow = createOllamaEmbeddingAdapter({ endpoint: `http://127.0.0.1:${port}`, model: "synthetic", timeoutMs: 250 });
  await assert.rejects(slow.embed(["alpha"]), /timed out or was cancelled/);
  const controller = new AbortController();
  const cancelled = slow.embed(["alpha"], { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, /timed out or was cancelled/);
});

test("embedding vectors have stable bounded dimensions", async (context) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ embeddings: [[1, 0], [1, 0, 2]] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const port = server.address().port;
  const adapter = createOllamaEmbeddingAdapter({ endpoint: `http://127.0.0.1:${port}`, model: "synthetic" });
  await assert.rejects(adapter.embed(["alpha", "beta"]), /consistent dimensions/);
});
