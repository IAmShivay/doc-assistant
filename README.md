# Doc Assistant - Multi-Workspace Document RAG + Tool Calling

A full-stack AI assistant that answers questions grounded in uploaded documents, with strict workspace isolation and tool calling.

**Live URL:** https://doc-assistant-production-1095.up.railway.app

## What It Does

- **Multi-workspace** - create and switch between isolated workspaces, each with its own documents and chat history
- **Document ingestion** - upload .txt, .md, .csv, .json, .pdf files; chunked, embedded, and stored in a shared vector store tagged by workspace
- **RAG chat** - answers grounded only in the active workspace's documents, with source citations
- **Tool calling** - the assistant can save tasks, send Discord notifications, and list tasks
- **Workspace isolation** - one shared chunks table, queries scoped by workspace_id at the database level
- **Dashboard** - documents, chat history, tool call logs, saved tasks, workspace switcher

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | API routes + frontend in one build, simple Railway deployment |
| Database | SQLite via sql.js (pure JS) | Zero native dependencies, no compilation issues, works everywhere |
| Vector Search | TF-IDF + cosine similarity in JS | No external API dependency, instant, no rate limits |
| LLM | Groq (openai/gpt-oss-120b) | Free tier, no credit card, tool calling support |
| Embeddings | Local TF-IDF (2048-dim hash vectors) | No API needed, consistent IDF at query time |
| Auth | JWT + bcrypt | Stateless, simple |
| Icons | lucide-react | Clean, lightweight |

## Architecture

```
Next.js App (Railway)
  |
  +-- app/page.js              (React frontend - login/dashboard)
  +-- app/api/auth/*            (JWT register/login)
  +-- app/api/workspaces/*      (CRUD + membership)
  +-- app/api/documents/*       (upload, chunk, embed)
  +-- app/api/chat/*/send       (RAG retrieval + Groq + tool calling loop)
  |
  +-- lib/db.js                 (SQLite via sql.js, single chunks table)
  +-- lib/embeddings.js         (TF-IDF vectors, cosine similarity)
  +-- lib/tools.js              (save_task, send_notification, list_tasks)
  +-- lib/auth.js               (JWT verify, workspace membership check)
  |
  +-- External: Groq API        (LLM chat + tool calling)
  +-- External: Discord Webhook (notifications)
```

## Workspace Isolation

All chunks from all workspaces live in ONE chunks table. Isolation is enforced by:

```sql
SELECT * FROM chunks WHERE workspace_id = ?
```

This is a pre-filter - chunks from other workspaces are never loaded into memory or compared. Three layers enforce isolation:
1. **Database**: WHERE workspace_id = ? in every query
2. **Auth**: checkWorkspaceMember() verifies membership before any operation
3. **LLM**: Only active workspace's chunks enter the system prompt

### Testing isolation
1. Create Workspace A, upload a doc with "The secret code is ALPHA-7"
2. Create Workspace B, upload a different doc
3. In Workspace B, ask "What is the secret code?"
4. Expected: "I don't have enough information..." (not ALPHA-7)

## RAG Pipeline

```
1. User sends question
2. Embed question using TF-IDF (same method as chunks)
3. Load all chunks WHERE workspace_id = active workspace
4. Compute cosine similarity, take top 8 (or 16 if scores are low)
5. Wrap chunks in <document_chunk> XML data tags
6. Send to Groq with system prompt + tool definitions
7. If tool_call returned: validate args, execute, feed result back, loop (max 5)
8. Return answer + citations + tool calls + retrieved chunks (debug)
```

## Tool Calling

| Tool | Description | Side Effect |
|------|-------------|-------------|
| save_task | Save a task with title + description | Writes to tasks table |
| send_notification | Send message to Discord | Posts via webhook |
| list_tasks | List workspace tasks | Read-only |

Tool arguments are validated against a schema before execution. Unknown tools, missing fields, and malformed args are rejected and logged. Multi-step tool calling is supported (max 5 rounds).

## Security

- **Prompt injection defense**: Chunks wrapped in XML data tags, system prompt treats them as DATA only
- **SQL injection**: All queries use parameterized statements
- **API keys**: Server-side only (Next.js API routes), never sent to browser
- **Error sanitization**: Raw API errors logged server-side only, sanitized messages to client
- **Auth**: JWT with 7-day expiry, automatic logout on 401

## Observability

Each chat response includes expandable panels showing:
- Embedding, retrieval, and total latency (ms)
- Number of chunks retrieved and above threshold
- Token usage (prompt, completion, total) from Groq
- Retrieved chunks with source names and similarity scores

Tool call logs with success/failure visible in the Tool Logs tab.

## Stretch Goals Implemented

- Retrieval-debug view (shows chunks + scores per answer)
- Multi-step tool use (5-round loop)
- Observability (latency, tokens, retrieval stats)
- Retry button on failed responses

## Local Setup

### Prerequisites
- Node.js 18+
- Groq API key (free, no credit card): https://console.groq.com/keys

### Steps

```bash
git clone https://github.com/IAmShivay/doc-assistant.git
cd doc-assistant
npm install
cp .env.example .env
# Edit .env - add GROQ_API_KEY and JWT_SECRET
npm run dev
```

Open http://localhost:3000

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GROQ_API_KEY | Yes | Groq API key (free tier) |
| JWT_SECRET | Yes | Secret for signing JWT tokens |
| DISCORD_WEBHOOK_URL | No | Discord webhook for send_notification tool |

## Deploy to Railway

1. Push to GitHub
2. Connect Railway to the repo
3. Set environment variables (GROQ_API_KEY, JWT_SECRET)
4. Railway auto-detects Next.js, builds and deploys
5. Generate a domain under Networking

## Testing the App

### Test account
Register with any email/password (min 6 chars). No email verification.

### Test flow
1. Register - auto-creates "My Workspace"
2. Documents tab - upload a .txt or .pdf file
3. Chat tab - ask a question - get cited answer
4. Ask something not in the document - get "I don't know" response
5. Ask "Save a task to review this document" - tool fires
6. Tool Logs tab - see the save_task call logged
7. Create second workspace - upload different doc - verify isolation

### Sample documents

**workspace-a.txt:**
```
Project Phoenix is a cloud migration initiative led by Sarah Chen.
The target completion date is March 2025. The budget is $2.4M.
Key milestones: Phase 1 (assessment) complete, Phase 2 (migration) in progress.
The primary risk is data loss during the PostgreSQL to Aurora migration.
```

**workspace-b.txt:**
```
Q3 Revenue Report: Total revenue was $14.2M, up 12% YoY.
Top performing product: DataSync Pro with $5.1M revenue.
Customer churn rate decreased to 3.2% from 4.1% in Q2.
New enterprise contracts signed: 23, including Fortune 500 company Meridian Corp.
```

## Postman Collection

Import `postman_collection.json` and `postman_environment.json` into Postman for API testing. The collection includes auto-set variables for token and workspace_id.

## API Reference

### Auth
- POST /api/auth/register - { email, password } - returns { token, user }
- POST /api/auth/login - { email, password } - returns { token, user }
- GET /api/auth/me - returns { user }

### Workspaces
- GET /api/workspaces - list user's workspaces
- POST /api/workspaces - { name } - create workspace
- DELETE /api/workspaces/:id - delete workspace

### Documents
- GET /api/documents/:wsId - list documents
- POST /api/documents/:wsId/upload - multipart/form-data with file
- DELETE /api/documents/:wsId/:docId - delete document

### Chat
- POST /api/chat/:wsId/send - { message } - returns { message, citations, toolCalls, retrievedChunks, observability }
- GET /api/chat/:wsId/history - chat history
- DELETE /api/chat/:wsId/history - clear history
- GET /api/chat/:wsId/tool-logs - tool execution logs
- GET /api/chat/:wsId/tasks - workspace tasks
