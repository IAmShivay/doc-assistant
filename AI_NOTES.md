# AI Notes

## Tools & Models Used
- **ChatGPT (GPT-4o)** for brainstorming architecture, debugging tricky issues, and generating boilerplate
- **GitHub Copilot** for inline code completions while writing components
- **Groq (openai/gpt-oss-120b)** as the runtime LLM for chat + tool calling (free tier, no credit card)
- **Local TF-IDF** for document chunk embeddings (no external API dependency)

## Key Decisions I Made

### 1. Next.js Full-Stack (vs. Express + Vite)
I initially prototyped with Express + React/Vite, but switched to Next.js for simpler deployment — API routes and frontend in one build, no separate static file serving to configure, and Railway auto-detects Next.js. The API route handlers map cleanly from Express: `req.body` → `await req.json()`, `res.json()` → `NextResponse.json()`.

### 2. sql.js Instead of better-sqlite3
I chose `sql.js` (pure JavaScript SQLite compiled from C via Emscripten) over `better-sqlite3` (native C++ addon). Reason: `better-sqlite3` requires Node-gyp, Python, and a C++ compiler to build, and the compiled binary is tied to a specific Node.js version — this caused `ERR_DLOPEN_FAILED` errors locally and broke Railway deployments. `sql.js` has zero native dependencies, works on any platform, any Node version, with no build tools. The tradeoff is slightly slower query performance, which is irrelevant at demo scale.

### 3. Local TF-IDF Embeddings (vs. External API)
I started with Google Gemini's text-embedding-004 API, then tried HuggingFace Inference API — both had reliability/availability issues on the free tier. Switched to local TF-IDF: hash-based vocabulary (2048 dims), term frequency × inverse document frequency, cosine similarity. It runs instantly with no network calls. The tradeoff is it misses semantic similarity (synonyms), but for keyword-heavy document QA it works well. Embeddings are computed at query time so the IDF stays consistent when new documents are added.

### 4. Workspace Filter Inside the Vector Search Query
The retrieval function queries `WHERE workspace_id = ?` before computing similarity scores. Chunks from other workspaces are never loaded into memory. This is a pre-filter, not a post-filter — it's the tenancy boundary.

### 5. Tool Calling Loop with Validation
Groq proposes a function call → validate against a strict schema (reject unknown tools, missing required fields) → execute → feed result back → Groq decides to call another or respond. Capped at 5 rounds to prevent infinite loops. Every call is logged to `tool_logs` with full args and results.

## Hardest Bug / Wrong Turn
The `better-sqlite3` native module was the biggest time sink. It compiled against Node v22 but Next.js loaded it with Node v24, causing `ERR_DLOPEN_FAILED`. Rebuilding didn't help because npm's `allowScripts` policy blocked the rebuild. I tried Dockerfile builds, nixpacks configs, and multiple `npm rebuild` attempts before realizing the fundamental issue: native modules are fragile across environments. The permanent fix was switching to `sql.js` — a pure JS SQLite that needs no compilation at all. This also solved the Railway deployment issue where the Docker build succeeded but the container crashed at runtime because the native binary was compiled for the wrong platform.

ChatGPT initially suggested `better-sqlite3` as the "standard" choice, and I went with it. The lesson: for deployment-sensitive projects, prefer pure JS implementations over native addons unless performance demands otherwise.

## AI Context/Instruction Files
I did not use any persistent AI context files (no .cursorrules, AGENTS.md, etc.) during development. I worked iteratively — prompting for specific pieces as needed and integrating them manually.

## What I'd Improve With More Time
- **Streaming responses** via Server-Sent Events for better UX on slow LLM responses
- **Neural embeddings** — local all-MiniLM-L6-v2 via ONNX runtime for semantic similarity
- **Hybrid search** combining TF-IDF + BM25 keyword search for better recall
- **Re-ranking** using a cross-encoder to refine top-K results
- **Request queuing** to handle Groq free tier rate limits more gracefully
- **WebSocket-based chat** for real-time updates when tools fire
- **Cross-workspace document sharing** with explicit opt-in permissions
- **PostgreSQL migration** for horizontal scaling and pgvector support
