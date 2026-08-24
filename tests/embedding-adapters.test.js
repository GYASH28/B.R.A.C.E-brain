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
