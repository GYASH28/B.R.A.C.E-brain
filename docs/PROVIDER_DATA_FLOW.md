# Provider data flow

```text
question
  -> local secret redaction
  -> local lexical/hybrid retrieval
  -> bounded context capsule
  -> visible provider preview + confirmation
  -> configured CLI/provider
  -> local conversation history
  -> explicit retain action only
  -> durable BRACE memory
```

The confirmation identifies the client/provider, context categories, memory/source counts, scopes/projects, and whether redaction changed the prompt. Cancelling stops before the provider call.

Lexical retrieval never leaves the device. Local Ollama embeddings are loopback-only. An optional OpenAI-compatible embedding endpoint may receive bounded redacted chunks over HTTPS; its endpoint and disclosure are explicit. Redirects are rejected. Responses have deadlines and byte limits and must contain the expected number of finite, consistent vectors.

Provider responses do not become memory automatically. Conversation history and durable memory are separate stores and retention is an explicit user action.
