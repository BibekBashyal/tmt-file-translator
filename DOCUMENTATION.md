# TMT File Translator — Project Documentation

**Google TMT Hackathon 2026 · Track B2 · Kathmandu University**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Design Decisions & Evolution](#5-design-decisions--evolution)
6. [Key Features](#6-key-features)
7. [Cache System](#7-cache-system)
8. [UI Features](#8-ui-features)
9. [Scalability](#9-scalability)
10. [Supported Formats & Languages](#10-supported-formats--languages)
11. [API Reference](#11-api-reference)
12. [How to Run](#12-how-to-run)

---

## 1. Project Overview

TMT File Translator is a document translation tool that preserves the exact formatting and layout of files while translating their content between English, Nepali, and Tamang. Unlike plain-text translation tools, it returns the translated content inside the original file structure — a PDF comes back as a PDF, a DOCX comes back as a DOCX, with all fonts, tables, bold/italic, and column positions intact.

The tool is built as a two-service system: a Python/FastAPI backend that handles file parsing and the TMT API integration, and a React/TypeScript frontend that provides real-time streaming progress, inline editing, and preview before download.

---

## 2. Problem Statement

Existing document translation workflows require users to:
1. Copy text out of the document manually
2. Paste it into a translation tool
3. Copy the result back
4. Re-apply all the original formatting by hand

For Nepali and Tamang languages this is especially painful because Devanagari script requires specific fonts that most tools do not handle. A PDF translated by a naive tool comes back as scrambled characters or plain unstyled text.

TMT File Translator solves this by treating translation as a two-step pipeline: first extract text with its positional and style metadata, translate only the text, then reconstruct the original file by writing the translated text back into the original coordinates and styles.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Frontend  (Port 3000)                        │
│  Vite + TypeScript + Tailwind CSS v4                │
└─────────────────────┬───────────────────────────────┘
                      │  nginx reverse-proxy
                      │  /api/* → doc-service:8000
                      ▼
┌─────────────────────────────────────────────────────┐
│  Python Doc Service  (Port 8000)                    │
│  FastAPI + PyMuPDF + python-docx                    │
│                                                     │
│  POST /api/v1/translate/stream   ← SSE stream       │
│    ├─ parse file → extract segments                 │
│    ├─ check LRU cache (50 000-entry cap)            │
│    ├─ deduplicate identical texts                   │
│    ├─ call TMT API sequentially (throttled)         │
│    └─ stream progress events back to browser        │
│                                                     │
│  POST /reconstruct                                  │
│    └─ rebuild original file with edited segments    │
│                                                     │
│  .tmt-cache.json  (disk-persisted LRU cache)        │
│  .tmt-cooldown    (persisted calibration result)    │
└─────────────────────┬───────────────────────────────┘
                      │  HTTPS
                      ▼
          TMT API  (tmt.ilprl.ku.edu.np)
```

### Request Flow

1. User uploads a file and selects languages in the browser
2. Browser opens an SSE connection to `/api/v1/translate/stream`
3. Backend extracts text segments from the file with full positional metadata
4. Each segment is checked against the in-memory LRU cache
5. Uncached segments are deduplicated then sent to the TMT API one at a time
6. Each translated segment is streamed back to the browser as a progress event
7. On completion the fully translated file is base64-encoded and sent in the final `done` event
8. If the user edits any segment in the browser, `POST /reconstruct` rebuilds the file server-side with the edited content and returns it for download

### Deployment

Both services are containerised with Docker. nginx runs inside the frontend container and acts as a reverse proxy — all `/api/` requests from the browser go to nginx on port 3000, which forwards them internally to the doc-service on port 8000. Port 8000 is never exposed directly to the public internet.

---

## 4. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18, TypeScript 5 | Type-safe component model, strong ecosystem |
| Build tool | Vite 5 | Fast HMR, native ESM, env var injection at build time |
| Styling | Tailwind CSS v4 | Utility-first, no runtime CSS |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| Backend | Python 3.12, FastAPI | Async-capable, excellent file handling libraries, fast to iterate |
| ASGI server | Uvicorn | Production-grade ASGI server for FastAPI |
| HTTP client | httpx (sync) | Reliable, timeout-safe HTTP for TMT API calls |
| PDF parsing | PyMuPDF (fitz) | Span-level text extraction with full bbox/font metadata |
| DOCX parsing | python-docx | Native OOXML manipulation preserving runs, tables, styles |
| Font | Noto Sans Devanagari | Bundled font ensures Nepali/Tamang renders correctly in rebuilt PDFs |
| Streaming | Server-Sent Events (SSE) | Unidirectional, browser-native, no WebSocket overhead |
| Reverse proxy | nginx | SSE buffering disabled, long-poll timeout configured |
| Containerisation | Docker, Docker Compose | One-command deployment, environment parity |

---

## 5. Design Decisions & Evolution

### Initial Plan: Java with Virtual Threads

The original architecture used Java (Spring Boot) as the backend, motivated by Java 21's Virtual Threads (Project Loom). Virtual Threads make it possible to handle thousands of concurrent blocking I/O operations (like TMT API calls) without a thread-per-request model, which is attractive for a translation service where each segment involves a blocking HTTP call.

The Java service was scaffolded and the orchestrator was wired up. However, during development the document parsing requirements became clear:

- PDF reconstruction requires span-level coordinate access and font embedding (Devanagari) — the Java PDF ecosystem (PDFBox, iText) is significantly more complex for this use case than PyMuPDF, which exposes the exact span/bbox API needed in a few lines.
- DOCX manipulation with style preservation is more mature in python-docx than Apache POI for this specific pattern.
- Iteration speed in Python for file-format manipulation was significantly faster during the hackathon timeline.

**Decision:** Migrated the backend entirely to Python/FastAPI. The concurrency concern (the original motivation for Virtual Threads) is a non-issue in practice because the TMT API is rate-limited to sequential requests anyway — parallelism would trigger 429 errors. Sequential, throttled calls in Python are sufficient and correct.

The Java orchestrator service was removed from the repository once the Python service was confirmed working.

### SSE over WebSockets

Server-Sent Events were chosen over WebSockets for the streaming progress because:
- Translation is inherently unidirectional — data flows server → client only
- SSE is a standard HTTP connection, works through any proxy, and requires no special server support
- The browser's native `EventSource` API handles reconnection automatically
- nginx configuration for SSE is straightforward (`proxy_buffering off`, `proxy_read_timeout 3600s`)

### Sequential TMT API Calls

The TMT API enforces a per-key rate limit. Early testing showed that parallel requests reliably triggered 429 responses. The system therefore sends requests one at a time with a calibrated cooldown between them. This is not a limitation of the architecture — it is the correct behaviour for the available API.

### Startup Calibration

Rather than hardcoding a cooldown value, the service probes the TMT API at startup with decreasing intervals (500ms → 300ms → 200ms → 150ms) to find the minimum safe interval. The result is persisted to `.tmt-cooldown` so subsequent restarts skip the probe. This means the service automatically adapts if the API's rate limit changes.

### nginx as the Single Entry Point

Running nginx inside the frontend container (rather than as a separate service) keeps the deployment simple — one public port (3000), one docker-compose entry for the frontend. nginx handles static file serving, gzip, and API proxying in one place.

---

## 6. Key Features

### Translation Pipeline

| Feature | Detail |
|---------|--------|
| SSE streaming | Progress is pushed segment-by-segment — the user sees each translated piece arrive in real time rather than waiting for the entire document |
| Deduplication | If a document contains the same sentence 10 times, it is translated once and applied to all 10 occurrences — saves API calls and time |
| Disk-persisted LRU cache | 50,000-entry cache survives server restarts; re-translating the same document is near-instant |
| Rate-limit handling | On a 429 response the service backs off for 65 seconds automatically; the UI shows a live countdown so the user is not left confused |
| Cancel mid-job | An abort button stops translation immediately via a server-side threading event; already-cached segments are kept |
| Startup calibration | Probes the TMT API at startup to find the minimum safe request interval; result is persisted so it only runs once |
| Retry logic | Each TMT API call retries up to 5 times with exponential backoff before giving up |

### Format Preservation

| Format | What is preserved |
|--------|------------------|
| PDF | Exact span coordinates (bbox), original font sizes, Devanagari font embedding via bundled Noto Sans Devanagari |
| DOCX | Paragraphs, tables, runs, bold/italic/underline styles, heading levels |
| CSV / TSV | Grid structure, delimiters, column alignment |

---

## 7. Cache System

The cache is an `OrderedDict` held in memory and mirrored to `.tmt-cache.json` on disk.

**Key format:** `"{src_lang}\0{tgt_lang}\0{original_text}"`
The null byte separator ensures no accidental key collisions between language codes and text.

**Lifecycle of one entry:**

1. A segment is translated for the first time → written to the right end of the dict (most recent) and flushed to disk immediately
2. The same segment is requested again → cache hit, entry moved to the right end, no API call
3. New entries keep arriving → the entry slowly drifts left as it is used less
4. The dict reaches 50,001 entries → the leftmost entry (least recently used) is evicted automatically

**Write-through persistence:** Every new translation is written to disk immediately, not batched. If the server crashes mid-job, every segment translated before the crash is already saved.

**Startup trim:** If the cache file on disk exceeds 50,000 entries (possible if the limit was different in a previous version), the oldest entries are dropped on load.

**Effect on user experience:**
- First translation of a document: all API calls, normal speed
- Second translation of the same document: all cache hits, near-instant
- Two documents with overlapping sentences: shared sentences are free on the second document

---

## 8. UI Features

| Feature | Detail |
|---------|--------|
| Drag and drop upload | File can be dragged onto the upload area or selected via file picker |
| File preview before translating | Uploaded DOCX and CSV files can be previewed in the browser before translation starts |
| Inline pre-translation editing | Text content of the uploaded file can be edited before submitting for translation |
| Live streaming progress | A progress bar and segment counter update in real time as each segment is translated |
| Backoff countdown | When the TMT API rate-limits the service, a live countdown timer shows the user how many seconds remain |
| Cancel button | Stops an in-progress translation immediately |
| Side-by-side diff viewer | After translation, original and translated segments are shown side by side in a modal |
| Inline segment editing | Any translated segment can be edited directly in the browser before downloading |
| Amber highlight on edits | Edited segments are highlighted in amber so the user can track what they changed |
| Save & Download | Edits trigger a server-side file reconstruction — the downloaded file reflects the user's changes |
| Translation stats | The success card shows segment count, cache hit rate, API call count, and processing time |
| Preview before downloading toggle | When unchecked, the file downloads automatically on completion without opening the preview |
| Mobile responsive | Flexbox constraints prevent long filenames from overflowing and pushing action buttons off-screen |

---

## 9. Scalability

The current architecture is intentionally simple for a hackathon context, but it is designed to scale in clear steps.

**Horizontal scaling (multiple backend instances)**
The only shared state is the LRU cache file and the cooldown file. Moving these to a shared volume or replacing the cache with Redis would allow multiple backend instances behind a load balancer. The `TmtClient` class already encapsulates all mutable state, so there is no global module-level state to refactor.

**Cache scaling**
The `OrderedDict` cache can be replaced with Redis (same LRU semantics, built-in TTL, shared across instances) without changing any calling code — the `_cache.get()`, `_cache[key] = value`, and `_cache.move_to_end()` calls map directly to Redis `GET`, `SET`, and `ZADD`/sorted set operations.

**API throughput scaling**
The TMT API is the throughput bottleneck. If multiple API keys become available, the `TmtClient` could be extended to a pool of clients, each with its own rate limiter, enabling parallel translation of segments across keys.

**Frontend scaling**
The frontend is a static build served by nginx. It scales to any CDN with no changes.

**Database**
There is no database currently. Translation history and user session state are held in memory. Adding PostgreSQL for translation job history would be a straightforward addition to the FastAPI layer.

---

## 10. Supported Formats & Languages

### File Formats

| Extension | Max Size | Notes |
|-----------|----------|-------|
| `.pdf` | 1 MB | Span-level extraction; Devanagari font bundled for output |
| `.docx` | 1 MB | Full OOXML manipulation; preserves runs, tables, styles |
| `.csv` | 1 MB | Grid structure and delimiters preserved |
| `.tsv` | 1 MB | Tab-separated; same pipeline as CSV |

### Languages

| Code | Language | Script |
|------|----------|--------|
| `en` | English | Latin |
| `ne` | Nepali | Devanagari |
| `tam` | Tamang | Devanagari |

Note: The TMT API uses `tmg` internally for Tamang. The service maps `tam → tmg` transparently so callers always use the consistent `tam` code.

---

## 11. API Reference

Base URL: `http://localhost:8000` (or proxied via nginx at `http://localhost:3000`)

### `POST /api/v1/translate/stream`

Translates a document and streams progress as Server-Sent Events.

**Form fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Document to translate |
| `sourceLang` | string | `en`, `ne`, or `tam` |
| `targetLang` | string | `en`, `ne`, or `tam` |

**SSE event types**

| Event | Payload | Description |
|-------|---------|-------------|
| `extracted` | `{ total }` | Segments extracted, translation starting |
| `segment` | `{ current, total }` | One segment translated |
| `backoff` | `{ seconds }` | Rate-limited — waiting N seconds |
| `done` | `{ filename, file (base64), mediaType, segments, segmentCount, cacheHits, apiCalls, processingTimeMs }` | Translation complete |
| `error` | `{ message }` | Fatal error |

### `POST /reconstruct`

Rebuilds the original file with user-edited segment texts.

**Form fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The original uploaded file |
| `segments` | JSON string | Array of `{ id, text, meta }` objects |

Returns the reconstructed file as a binary response with the appropriate `Content-Type`.

### `GET /health`

Returns `{ "status": "healthy", "service": "doc-service" }`. Used by Docker healthcheck.

---

## 12. How to Run

### Requirements

- Docker and Docker Compose
- A TMT API key

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/BibekBashyal/tmt-file-translator.git
cd tmt-file-translator

# 2. Configure environment
cp .env.example .env
# Open .env and set:
#   TMT_API_KEY=your_key_here

# 3. Start all services
docker compose up --build
```

Open **http://localhost:3000** in your browser.

> Note: On first start the doc-service runs a calibration probe against the TMT API. This takes approximately 60–70 seconds. The frontend will become available once the backend is healthy.

### Stopping

```bash
docker compose down
```

### Local Development (without Docker)

**Backend:**
```bash
cd doc-service-python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend-react
npm install
# Create frontend-react/.env.local with:
#   VITE_API_BASE=http://localhost:8000
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:8000`.

---

## Repository

**GitHub:** https://github.com/BibekBashyal/tmt-file-translator

**Release v1.0.0:** https://github.com/BibekBashyal/tmt-file-translator/releases/tag/v1.0.0

The release includes `docker-compose.prod.yml` and `.env.example` as downloadable artifacts for one-command deployment.
