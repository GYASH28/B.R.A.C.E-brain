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

async function fetchJson(url, init, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  externalSignal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });
    const declaredBytes = Number(response.headers.get("content-length") || 0);
    if (declaredBytes > 5_000_000) {
      throw new Error("Embedding provider response exceeded the 5 MB safety limit.");
    }
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > 5_000_000) {
      throw new Error("Embedding provider response exceeded the 5 MB safety limit.");
    }
    if (!response.ok) {
      throw new Error(`Embedding provider returned HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
    return JSON.parse(body);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");
    const errorText = String(error?.cause?.message || error?.message || "");
    if (/redirect/i.test(errorText)) {
      throw new Error("Embedding provider redirects are not allowed.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", cancel);
  }
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
      const input = Array.isArray(texts) ? texts.map(String) : [String(texts)];
      const payload = await fetchJson(`${endpoint}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input }),
      }, Number(options.timeoutMs) || 120_000, context.signal);
      if (!Array.isArray(payload.embeddings)) {
        throw new Error("Ollama did not return embedding vectors.");
      }
      return payload.embeddings;
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
      const input = Array.isArray(texts) ? texts.map(String) : [String(texts)];
      const payload = await fetchJson(`${endpoint}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, input }),
      }, Number(options.timeoutMs) || 120_000, context.signal);
      const ordered = Array.isArray(payload.data)
        ? [...payload.data].sort((left, right) => Number(left.index) - Number(right.index))
        : [];
      if (ordered.length !== input.length || ordered.some((item) => !Array.isArray(item.embedding))) {
        throw new Error("The embedding provider returned an unexpected response.");
      }
      return ordered.map((item) => item.embedding);
    },
  };
}

module.exports = {
  createOllamaEmbeddingAdapter,
  createOpenAiCompatibleEmbeddingAdapter,
  normalizeEndpoint,
};
