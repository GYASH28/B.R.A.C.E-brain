"use strict";

function normalizeEndpoint(value, { loopbackOnly = false } = {}) {
  const endpoint = new URL(String(value || "").trim());
  if (!new Set(["http:", "https:"]).has(endpoint.protocol)) {
    throw new Error("Embedding endpoints must use HTTP or HTTPS.");
  }
  const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (loopbackOnly && (endpoint.protocol !== "http:" || !loopback.has(endpoint.hostname.toLowerCase()))) {
    throw new Error("Local embeddings must use an HTTP loopback endpoint.");
  }
  if (!loopbackOnly && endpoint.protocol !== "https:" && !loopback.has(endpoint.hostname.toLowerCase())) {
    throw new Error("Remote embedding endpoints must use HTTPS.");
  }
  return endpoint.origin;
}

async function readBoundedBody(response, maximumBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maximumBytes) throw new Error("Embedding provider response exceeded the safety limit.");
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body) > maximumBytes) throw new Error("Embedding provider response exceeded the safety limit.");
    return body;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new Error("Embedding provider response exceeded the safety limit.");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

async function fetchJson(url, init, options = {}) {
  const timeoutMs = Math.min(300_000, Math.max(250, Number(options.timeoutMs) || 120_000));
  const maximumBytes = Math.min(10_000_000, Math.max(1_024, Number(options.maximumBytes) || 2_000_000));
  const retries = Math.min(3, Math.max(0, Number(options.retries) || 0));
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: controller.signal,
      });
      const retryable = response.status === 429 || response.status >= 500;
      if (!response.ok) {
        await response.body?.cancel?.();
        if (retryable && attempt < retries && !options.signal?.aborted) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(800, 100 * (2 ** attempt))));
          continue;
        }
        throw new Error(`Embedding provider returned HTTP ${response.status}.`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        await response.body?.cancel?.();
        throw new Error("Embedding provider returned a non-JSON response.");
      }
      const body = await readBoundedBody(response, maximumBytes);
      try {
        return JSON.parse(body);
      } catch {
        throw new Error("Embedding provider returned malformed JSON.");
      }
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  throw new Error("Embedding request failed.");
}

function validateEmbeddingVectors(vectors, expectedCount) {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw new Error("The embedding provider returned an unexpected vector count.");
  }
  let dimensions = null;
  return vectors.map((vector) => {
    if (!Array.isArray(vector) || vector.length < 2 || vector.length > 4_096) {
      throw new Error("Embedding vectors must contain between 2 and 4,096 dimensions.");
    }
    if (dimensions === null) dimensions = vector.length;
    if (vector.length !== dimensions) throw new Error("Embedding vectors must use consistent dimensions.");
    const normalized = vector.map(Number);
    if (normalized.some((value) => !Number.isFinite(value))) {
      throw new Error("Embedding vectors may contain only finite numbers.");
    }
    return normalized;
  });
}

function normalizeInput(texts) {
  const input = (Array.isArray(texts) ? texts : [texts]).map((value) => String(value || ""));
  if (input.length < 1 || input.length > 256) throw new Error("Embedding batches may contain 1 to 256 texts.");
  if (input.some((value) => value.length > 50_000) || input.reduce((total, value) => total + value.length, 0) > 1_000_000) {
    throw new Error("Embedding input exceeds the bounded request size.");
  }
  return input;
}

function createOllamaEmbeddingAdapter(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint || "http://127.0.0.1:11434", { loopbackOnly: true });
  const model = String(options.model || "nomic-embed-text").trim();
  if (!model) throw new Error("Choose an Ollama embedding model.");
  return {
    id: "ollama",
    model: `ollama:${model}`,
    local: true,
    async embed(texts, context = {}) {
      const input = normalizeInput(texts);
      const payload = await fetchJson(`${endpoint}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input }),
      }, { timeoutMs: options.timeoutMs, maximumBytes: options.maximumBytes, retries: options.retries, signal: context.signal });
      return validateEmbeddingVectors(payload.embeddings, input.length);
    },
  };
}

function createOpenAiCompatibleEmbeddingAdapter(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint, { loopbackOnly: false });
  const model = String(options.model || "").trim();
  const apiKey = String(options.apiKey || "").trim();
  if (!model) throw new Error("Choose an embedding model.");
  if (!apiKey && !new Set(["127.0.0.1", "localhost", "::1", "[::1]"]).has(new URL(endpoint).hostname.toLowerCase())) {
    throw new Error("A remote embedding endpoint requires an API key.");
  }
  return {
    id: "openai-compatible",
    model: `openai-compatible:${model}`,
    local: new URL(endpoint).protocol === "http:",
    async embed(texts, context = {}) {
      const input = normalizeInput(texts);
      const payload = await fetchJson(`${endpoint}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, input }),
      }, { timeoutMs: options.timeoutMs, maximumBytes: options.maximumBytes, retries: options.retries, signal: context.signal });
      const ordered = Array.isArray(payload.data)
        ? [...payload.data].sort((left, right) => Number(left.index) - Number(right.index))
        : [];
      if (ordered.length !== input.length || ordered.some((item) => !Array.isArray(item.embedding))) {
        throw new Error("The embedding provider returned an unexpected response.");
      }
      return validateEmbeddingVectors(ordered.map((item) => item.embedding), input.length);
    },
  };
}

module.exports = {
  createOllamaEmbeddingAdapter,
  createOpenAiCompatibleEmbeddingAdapter,
  fetchJson,
  normalizeEndpoint,
  validateEmbeddingVectors,
};
